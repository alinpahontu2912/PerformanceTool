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

        var keys = Object.keys(obj);
        var newMap = new Map();
        for (var i = 0; i < keys.length; i++) {
            newMap.set(keys[i], obj[keys[i]]);
        }
        return newMap;

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

    function getLastDaysData(data, numOfDays, keys) {
        var timeDif = 1000 * 60 * 60 * 24 * numOfDays; // ms * s * mins * h * days
        var lastTest = new Date(data[data.length - 1].commitTime);
        var result = data.filter(x => new Date(x.commitTime) >= lastTest - timeDif);
        return result;
    }

    function buildGraph(data, flavors) {
        const margin = { top: 30, right: 60, bottom: 30, left: 60 },
            width = 800 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        var dataGroup1 = d3.select("body")
            .append("div");

        var dataGroup = dataGroup1.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        var filteredData = mapByFlavor(data);

        var onZoom = d3.zoom().on("zoom", zoomFunction);
        function zoomFunction() {
            dataGroup.attr("transform", d3.zoomTransform(this));
        }
        onZoom(dataGroup);

        var colors = d3.schemeCategory10;
        const x = d3.scaleTime()
            .domain(d3.extent(data, function (d) { return new Date(d.commitTime); }))
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, function (d) { return +d.minTime; })])
            .range([height, 0])
            .nice();

        function plotVariable(color, data) {
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

        function circlePoints(data, color, flavor) {
            data.forEach(function (point) {
                for (var i = 0; i < data.length; i++) {
                    dataGroup.append("circle")
                        .attr("fill", color)
                        .attr("r", 3)
                        .attr("cx", x(new Date(point.commitTime)))
                        .attr("cy", y(+point.minTime))
                        .append("title")
                        .text("Date: " + d3.timeFormat("%Y-%m-%d")(new Date(point.commitTime)) + "\n" + flavor + ": " + +point.minTime);

                }
            });
        }

        for (var i = 0; i < flavors.length; i++) {
            plotVariable(colors[i], filteredData.get(flavors[i]));
            circlePoints(filteredData.get(flavors[i]), colors[i], flavors[i]);
        }


        var xAxisGroup = dataGroup
            .append("g")
            .attr("class", "xAxisGroup")
            .attr("transform", "translate(0, " + height + ")");

        var xAxis = d3.axisBottom(x)
            .tickFormat(d3.timeFormat("%Y-%m-%d"));

        xAxis(xAxisGroup);

        var yAxisGroup = dataGroup
            .append("g")
            .attr("class", "yAxisGroup");

        var yAxis = d3.axisLeft(y);
        yAxis(yAxisGroup);

        d3.selectAll(".xAxisGroup .tick text")
            .attr("transform", "rotate(-15)");

        var title = dataGroup.append("g");
        title.append("text")
            .text(data[0].taskMeasurementName)
            .attr("font-size", "10pt")
            .attr("fill", "black")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", 10 - (margin.top / 2));


    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.loadData();
    promise.then(value => {
        var data = JSON.parse(value);
        var wantedData = getLastDaysData(data, 14);
        var flavors = getFlavors(data);
        // 0 for first test, meaning appStart reach managed 
        var firstTry = getWantedTestResults(wantedData, 0);
        buildGraph(firstTry, flavors);

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

