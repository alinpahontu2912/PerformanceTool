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

    function circlePoints(dataGroup, data, color, x, y, flavor, escapedFlavor) {
        var radius = 3;
        var circleGroup = dataGroup.append("g")
            .attr("class", escapedFlavor + "circleData");
        data.forEach(function (point) {
            circleGroup.append("circle")
                .attr("fill", color)
                .attr("r", radius)
                .attr("cx", x(new Date(point.commitTime)))
                .attr("cy", y(+point.minTime))
                .on("click", function () {
                    window.open(point.gitLogUrl, '_blank');
                })
                .append("title")
                .text("Exact date: " + point.commitTime + "\n" + "Flavor: " + flavor + "\n" + "Result: " + +point.minTime + " ms");

        });
    }

    function plotVariable(dataGroup, color, data, x, y, flavor, taskMeasurementNumber) {
        var className = flavor + taskMeasurementNumber;
        dataGroup.append("g")
            .append("path")
            .attr("class", className)
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(function (d) { return x(new Date(d.commitTime)); })
                .y(function (d) { return y(+d.minTime); })
            );

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

    function addLegendContent(legend, xCoord, yCoord, color, flavor, escapedFlavor, taskMeasurementNumber) {
        var lineClass = "." + escapedFlavor + taskMeasurementNumber;
        var circleClass = "." + escapedFlavor + "circleData";
        legend.append("text")
            .text(flavor)
            .attr("font-size", "7pt")
            .attr("fill", color)
            .attr("text-anchor", "middle")
            .attr("x", xCoord)
            .attr("y", yCoord)
            .on("click", function () {
                var visibility = d3.select(lineClass).style("visibility");
                d3.select(lineClass).transition().style("visibility", visibility == "visible" ? "hidden" : "visible");
                d3.select(circleClass).transition().style("visibility", visibility == "visible" ? "hidden" : "visible");
                var textStyle = d3.select(this).style("text-decoration");
                d3.select(this).transition().style("text-decoration", textStyle == "line-through" ? "none" : "line-through");
            });

    }

    function buildGraph(data, flavors, numOfDays, margin, taskMeasurementNumber) {

        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // create div and add styling to it
        var dataGroup = d3.select("body")
            .append("div")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        function changeSize() {
            numOfDays = this.value;
            console.log(this.value);

        }
        d3.select("#buttonSize").on("input", changeSize);

        // get data by flavor
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

        var startY = (height - flavors.length * 20) / 2 + 20;
        var legend = addLegendBorder(dataGroup, width, startY, flavors);
        // add data to graph
        for (var i = 0; i < flavors.length; i++) {
            var escapedFlavor = flavors[i].replaceAll(/[^a-zA-Z]/gi, '');
            plotVariable(dataGroup, colors[i], filteredData.get(flavors[i]), x, y, escapedFlavor, taskMeasurementNumber);
            circlePoints(dataGroup, filteredData.get(flavors[i]), colors[i], x, y, flavors[i], escapedFlavor);
            addLegendContent(legend, width + 40, startY, colors[i], flavors[i], escapedFlavor, taskMeasurementNumber);
            startY += 15;
        }
        // title
        addSimpleText(dataGroup, width / 2, 10 - (margin.top / 2), "12pt", data[0].taskMeasurementNumber, "black");
        // y axis legend
        addSimpleText(dataGroup, 0 - margin.top / 2, 0 - (margin.top / 2) + 10, "12pt", "Results (ms)", "black");

        // draw axis 
        yAxis(yAxisGroup);
        xAxis(xAxisGroup);
        // rotate x axis tick text
        d3.selectAll(".xAxisGroup .tick text")
            .attr("transform", "rotate(-15)");

    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.loadData();
    promise.then(value => {
        var data = JSON.parse(value);
        var wantedData = getLastDaysData(data, 14);
        var flavors = getFlavors(data);
        console.log(wantedData);
        const margin = { top: 60, right: 120, bottom: 80, left: 80 };
        for (var i = 0; i < 24; i++) {
            var firstTry = getWantedTestResults(wantedData, i);
            buildGraph(firstTry, flavors, 14, margin, i);
        }

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

