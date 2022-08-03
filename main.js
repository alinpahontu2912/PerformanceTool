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

    function circlePoints(dataGroup, data, color, x, y) {
        data.forEach(function (point) {
            dataGroup.append("circle")
                .attr("fill", color)
                .attr("r", 3)
                .attr("cx", x(new Date(point.commitTime)))
                .attr("cy", y(+point.minTime))
                .append("title")
                .text("Exact date: " + point.commitTime + "\n" + "Result: " + +point.minTime + " ms");

        });
    }

    function plotVariable(dataGroup, color, data, x, y) {
        dataGroup.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(function (d) { return x(new Date(d.commitTime)); })
                .y(function (d) { return y(+d.minTime); })
            )
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

    function addLegend(dataGroup, xCoord, startY, flavors, colors) {
        var circleRadius = 5;
        var textSpacing = 15;
        var rectWidth = 90;
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
        addSimpleText(legend, xCoord + 35, startY - 10, "7pt", "Chart Legend", "black");
        for (var i = 0; i < flavors.length; i++) {
            var yCoord = startY + i * textSpacing;
            legend.append("circle").attr("cx", xCoord).attr("cy", yCoord).attr("r", circleRadius).style("fill", colors[i]);
            legend.append("text").text(flavors[i]).attr("font-size", "5pt").attr("fill", "black").attr("text-anchor", "start").attr("x", xCoord + textSpacing).attr("y", yCoord);
        }
        return legend;
    }

    function buildGraph(data, flavors, numOfDays, margin) {

        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        var dataGroup = d3.select("body")
            .append("div")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        var svg = dataGroup.select("svg");
        var onZoom = d3.zoom().on("zoom", zoomFunction);
        function zoomFunction() {
            svg.attr("transform", d3.zoomTransform(this));
        }
        onZoom(svg);
        var filteredData = mapByFlavor(data);
        var colors = d3.schemeCategory10;

        const x = d3.scaleTime()
            .domain(d3.extent(data, function (d) { return new Date(d.commitTime); }))
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, function (d) { return +d.minTime; })])
            .range([height, 0])
            .nice();

        var xAxisGroup = dataGroup
            .append("g")
            .attr("class", "xAxisGroup")
            .attr("transform", "translate(0, " + height + ")");

        var xAxis = d3.axisBottom(x)
            .tickFormat(d3.timeFormat("%m/%d/%Y"))
            .ticks(numOfDays);

        xAxis(xAxisGroup);

        var yAxisGroup = dataGroup
            .append("g")
            .attr("class", "yAxisGroup");

        var yAxis = d3.axisLeft(y);
        yAxis(yAxisGroup);

        d3.selectAll(".xAxisGroup .tick text")
            .attr("transform", "rotate(-15)");


        for (var i = 0; i < flavors.length; i++) {
            plotVariable(dataGroup, colors[i], filteredData.get(flavors[i]), x, y);
            circlePoints(dataGroup, filteredData.get(flavors[i]), colors[i], x, y);
        }
        var title = addSimpleText(dataGroup, width / 2, 10 - (margin.top / 2), "12pt", data[0].taskMeasurementName, "black");
        var yAxisName = addSimpleText(dataGroup, 0 - margin.top / 2, 0 - (margin.top / 2) + 10, "12pt", "Results (ms)", "black");
        var startY = (height - flavors.length * 20) / 2;
        var legend = addLegend(dataGroup, width, startY, flavors, colors);
    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.loadData();
    promise.then(value => {
        var data = JSON.parse(value);
        var wantedData = getLastDaysData(data, 14);
        var flavors = getFlavors(data);
        // 0 for first test, meaning appStart reach managed 
        var firstTry = getWantedTestResults(wantedData, 0);
        const margin = { top: 60, right: 80, bottom: 80, left: 100 };
        buildGraph(firstTry, flavors, 14, margin);

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

