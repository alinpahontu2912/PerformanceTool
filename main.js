import { App } from './app-support.js'

App.main = async function (applicationArguments) {
    App.IMPORTS.window = {
        location: {
            href: () => globalThis.window.location.href
        }
    };

    function mapByFlavor(data) {
        var obj = data.reduce((map, e) => ({
            ...map,
            [e.flavor]: [...(map[e.flavor] ?? []), e]
        }), {});

        return new Map(Object.entries(obj));

    }

    function getWantedTestResults(test, testNumber, numTests = 24) {
        var array = [];
        for (let i = testNumber; i < test.length; i += numTests) {
            array.push(test[i]);
        }
        return array;
    }

    function getFlavors(data) {
        var set = new Set();
        for (var i = 0; i < data.length; i++) {
            set.add(data[i].flavor);
        }
        var keys = [...set];
        return keys;
    }

    function getLastDaysData(data, numOfDays) {
        var timeDif = 1000 * 60 * 60 * 24 * numOfDays; // ms * s * mins * h * days
        var lastTest = new Date(data[data.length - 1].commitTime);
        var result = data.filter(x => new Date(x.commitTime) >= lastTest - timeDif);
        return result;
    }

    function circlePoints(dataGroup, data, color, x, y, flavor) {
        var radius = 3;
        var circleGroup = dataGroup.append("g")
            .attr("class", "circleData");
        data.forEach(function (point) {
            circleGroup.append("circle")
                .attr("fill", color)
                .attr("r", radius)
                .attr("cx", x(new Date(point.commitTime)))
                .attr("cy", y(+point.minTime))
                .append("title")
                .text("Exact date: " + point.commitTime + "\n" + "Flavor: " + flavor + "\n" + "Result: " + +point.minTime + " ms");
        });
        return circleGroup;
    }

    function plotVariable(dataGroup, color, data, x, y, flavor, taskMeasurementName) {
        var flavorTestGroup = dataGroup
            .append("g")
            .append("path")
            .attr("class", flavor + taskMeasurementName)
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(function (d) { return x(new Date(d.commitTime)); })
                .y(function (d) { return y(+d.minTime); })
            );
        return flavorTestGroup;
    }

    function addSimpleText(dataGroup, xCoord, yCoord, textSize, text, color) {
        return dataGroup.append("g")
            .append("text")
            .text(text)
            .attr("font-size", textSize)
            .attr("fill", color)
            .attr("text-anchor", "middle")
            .attr("x", xCoord)
            .attr("y", yCoord);
    }

    function addLegendBorder(dataGroup, xCoord, startY, flavors) {
        var textSpacing = 15;
        var rectWidth = 100;
        var rectHeight = (flavors.length + 1) * textSpacing;
        var legend = dataGroup.append("g")
            .attr("class", "chart-legend");
        legend.append("rect")
            .attr("class", "legend")
            .attr("x", xCoord - 10)
            .attr("y", startY - 20)
            .attr("rx", "5px")
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("stroke", "black")
            .attr("fill", "white");
        addSimpleText(legend, xCoord + 40, startY - 10, "10pt", "Chart Legend", "black");
        return legend;
    }

    function addLegendContent(legend, lineGroup, circleGroup, xCoord, yCoord, color, flavor, taskMeasurementName) {
        /*var circleRadius = 5;
        var textSpacing = 15;
                legend.append("circle")
                    .attr("cx", xCoord)
                    .attr("cy", yCoord)
                    .attr("r", circleRadius)
                    .style("fill", color);*/
        legend.append("text")
            .text(flavor)
            .attr("font-size", "7pt")
            .attr("fill", color)
            .attr("text-anchor", "middle")
            .attr("x", xCoord)
            .attr("y", yCoord)
            .on("click", function () {
                var visibility = lineGroup.style("visibility");
                lineGroup.transition().style("visibility", visibility == "visible" ? "hidden" : "visible");
                circleGroup.transition().style("visibility", visibility == "visible" ? "hidden" : "visible");
                var textStyle = d3.select(this).style("text-decoration");
                d3.select(this).transition().style("text-decoration", textStyle == "line-through" ? "none" : "line-through");
            });

    }

    function buildGraph(data, flavors, numOfDays, margin, taskMeasurementName) {

        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        var dataGroup = d3.select("#graphs")
            .append("div")
            .style("display", "inline")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        var filteredData = mapByFlavor(data);
        var colors = d3.schemeCategory10;

        const x = d3.scaleTime()
            .domain(d3.extent(data, function (d) { return new Date(d.commitTime); }))
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain(d3.extent(data, function (d) { return +d.minTime; }))
            .range([height, 0])
            .nice();

        var xAxisGroup = dataGroup
            .append("g")
            .attr("class", "xAxisGroup")
            .attr("transform", "translate(0, " + height + ")");

        var xAxis = d3.axisBottom(x)
            .tickFormat(d3.timeFormat("%m/%d/%Y"))
            .ticks(numOfDays);

        var yAxisGroup = dataGroup
            .append("g")
            .attr("class", "yAxisGroup");

        var yAxis = d3.axisLeft(y);

        var flavorLineGroups = [];
        var flavorCircleGroups = [];
        for (var i = 0; i < flavors.length; i++) {
            var lineGroup = plotVariable(dataGroup, colors[i], filteredData.get(flavors[i]), x, y, flavors[i], taskMeasurementName);
            flavorLineGroups.push(lineGroup);
            var circleGroup = circlePoints(dataGroup, filteredData.get(flavors[i]), colors[i], x, y, flavors[i]);
            flavorCircleGroups.push(circleGroup);
        }
        var title = addSimpleText(dataGroup, width / 2, 10 - (margin.top / 2), "12pt", data[0].taskMeasurementName, "black");
        var yAxisName = addSimpleText(dataGroup, 0 - margin.top / 2, 0 - (margin.top / 2) + 10, "12pt", "Results (ms)", "black");
        var startY = (height - flavors.length * 20) / 2;
        var legend = addLegendBorder(dataGroup, width, startY, flavors);

        for (var i = 0; i < flavors.length; i++) {
            addLegendContent(legend, flavorLineGroups[i], flavorCircleGroups[i], width + 40, startY + 5, colors[i], flavors[i], taskMeasurementName);
            startY += 15;
        }
        yAxis(yAxisGroup);
        xAxis(xAxisGroup);
        d3.selectAll(".xAxisGroup .tick text")
            .attr("transform", "rotate(-15)");

    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.loadData();
    promise.then(value => {
        var data = JSON.parse(value);
        var wantedData = getLastDaysData(data, 14);
        var flavors = getFlavors(data);
        const margin = { top: 60, right: 120, bottom: 80, left: 80 };
        for (var i = 0; i < 24; i++) {
            var firstTry = getWantedTestResults(wantedData, i);
            buildGraph(firstTry, flavors, 14, margin, "ceva");
        }

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

