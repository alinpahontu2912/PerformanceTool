import { App } from './app-support.js'

App.main = async function (applicationArguments) {

    const regex = /[^a-zA-Z]/gi;
    const measurementsUrl = "https://raw.githubusercontent.com/radekdoulik/WasmPerformanceMeasurements/main/measurements/";
    const margin = { top: 60, right: 120, bottom: 80, left: 120 };

    function mapByFlavor(data) {
        var obj = data.reduce((map, e) => ({
            ...map,
            [e.flavor]: [...(map[e.flavor] ?? []), e]
        }), {});

        return new Map(Object.entries(obj));

    }

    function getWantedTestResults(data, testNumber, numTests = 24) {
        var array = [];
        for (let i = testNumber; i < data.length; i += numTests) {
            array.push(data[i]);
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

    function getResultsBetweenDates(data, startDate, endDate) {
        var result = data.filter(function (d) {
            var date = new Date(d.commitTime);
            return date >= startDate && date <= endDate;
        });
        return result;
    }

    function circlePoints(dataGroup, data, color, x, y, flavor, escapedFlavor, taskMeasurementNumber) {
        var radius = 3;
        var circleGroup = dataGroup.append("g")
            .attr("class", escapedFlavor + "circleData" + taskMeasurementNumber);
        circleGroup.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .on("click", function (d) {
                console.log(d.data)
                window.open(d.gitLogUrl, '_blank');
            })
            .attr("fill", color)
            .attr("r", radius)
            .attr("cx", function (d) { return x(new Date(d.commitTime)); })
            .attr("cy", function (d) { return y(+d.minTime) })
            .append("title")
            .text(function (d) { return "Exact date: " + d.commitTime + "\n" + "Flavor: " + flavor + "\n" + "Result: " + +d.minTime + " ms"; });
    }

    function plotVariable(dataGroup, color, data, x, y, flavor, taskMeasurementNumber) {
        var className = flavor + taskMeasurementNumber;
        var lineGroup = dataGroup.append("g");
        lineGroup
            .selectAll("path")
            .data([data])
            .enter()
            .append("path")
            .attr("class", className)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("d", d3.line().curve(d3.curveMonotoneX)
                .x(function (d) { return x(new Date(d.commitTime)); })
                .y(function (d) { return y(+d.minTime); })
            );
    }

    function addSimpleText(dataGroup, xCoord, yCoord, textSize, text, color, rotation = 0) {
        return dataGroup.append("g")
            .append("text")
            .text(text)
            .attr("transform", `rotate(${rotation})`)
            .attr("font-size", textSize)
            .attr("fill", color)
            .attr("text-anchor", "middle")
            .attr("x", xCoord)
            .attr("y", yCoord);
    }

    function addLegendBorder(dataGroup) {
        var legend = dataGroup
            .append("div")
            .attr("width", 400)
            .attr("height", 400)
            .append("form")
            .attr("class", "chart-legend");

        legend
            .append("p")
            .html("Chart Legend");
        return legend;
    }

    function addLegendContent(legend, color, flavor, escapedFlavor, taskMeasurementNumber) {
        var lineClass = "." + escapedFlavor + taskMeasurementNumber;
        var circleClass = "." + escapedFlavor + "circleData" + taskMeasurementNumber;
        legend.append("br");
        legend.append("input")
            .attr("type", "checkbox")
            .attr("checked", "true")
            .on("click", function () {
                var visibility = d3.select(lineClass).style("visibility");
                d3.select(lineClass).transition().style("visibility", visibility === "visible" ? "hidden" : "visible");
                d3.select(circleClass).transition().style("visibility", visibility === "visible" ? "hidden" : "visible");
            })
            .attr("id", lineClass)
        legend.append("label")
            .attr("for", lineClass)
            .style("color", color)
            .html(flavor);


    }

    function buildGraph(allData, flavors, numOfDays, taskMeasurementNumber) {

        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        var startDate;// = new Date(d3.select("#startDate").value);
        var endDate; //= new Date(d3.select("#endDate").value);

        var data = getLastDaysData(allData, 14);
        data = getWantedTestResults(data, taskMeasurementNumber);
        // create div and add styling to it
        var collapsible = d3.select("#graphs")
            .append("details");
        collapsible.append("summary")
            .html(data[0].taskMeasurementName);
        var dataGroup1 = collapsible.append("div");
        var dataGroup = dataGroup1
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

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

        var legend = addLegendBorder(collapsible);
        // add data to graph
        for (var i = 0; i < flavors.length; i++) {
            var escapedFlavor = flavors[i].replaceAll(regex, '');
            plotVariable(dataGroup, colors[i], filteredData.get(flavors[i]), x, y, escapedFlavor, taskMeasurementNumber);
            circlePoints(dataGroup, filteredData.get(flavors[i]), colors[i], x, y, flavors[i], escapedFlavor, taskMeasurementNumber);
            addLegendContent(legend, colors[i], flavors[i], escapedFlavor, taskMeasurementNumber);
        }
        // y axis legend
        addSimpleText(dataGroup, - margin.left, - margin.top, "15pt", "Results (ms)", "black", -90);

        // draw axis 
        yAxis(yAxisGroup);
        xAxis(xAxisGroup);
        // rotate x axis tick text
        d3.selectAll(".xAxisGroup .tick text")
            .attr("transform", "rotate(-15)");

        d3.select("#startDate").on("change", function () {
            startDate = new Date(this.value);
        });

        d3.select("#endDate").on("change", function () {
            endDate = new Date(this.value);
        });

        d3.select("#submit").on("click", function () {
            console.log("clicked");
            update();
        });

        function update() {
            if (typeof startDate === "undefined" || typeof endDate === "undefined") {
                alert("Choose valid dates!");
            }
            else {
                data = getResultsBetweenDates(allData, startDate, endDate);
                console.log(data);
            }

        }


    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.Program.loadData(measurementsUrl);
    var value = await promise;
    var data = JSON.parse(value);
    var flavors = getFlavors(data);
    for (var i = 0; i < 24; i++) {
        buildGraph(data, flavors, 14, i);
    }
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);
}

