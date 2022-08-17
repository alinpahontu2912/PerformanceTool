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

    function getWantedTestResults(data, testNumber, numTests = 28) {
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

    function getResultsBetweenDates(allData, startDate, endDate) {
        var result = allData.filter(function (d) {
            var date = new Date(d.commitTime);
            return date.getTime() >= startDate.getTime()
                && date.getTime() <= endDate.getTime();
        });
        return result;
    }

    function circlePoints(dataGroup, data, color, x, y, flavor, escapedFlavor, taskMeasurementNumber) {
        var radius = 3;
        var circleGroupName = escapedFlavor + "circleData" + taskMeasurementNumber;
        d3.select("." + circleGroupName).remove();
        if (data.length !== 0) {
            var circleGroup = dataGroup.append("g")
                .attr("class", circleGroupName)
                .selectAll("circle")
                .data(data);
            circleGroup
                .enter()
                .append("circle")
                .merge(circleGroup)
                .on("click", function (_, i) {
                    window.open(i.gitLogUrl, '_blank');
                })
                .attr("fill", color)
                .attr("r", radius)
                .attr("cx", function (d) { return x(new Date(d.commitTime)); })
                .attr("cy", function (d) { return y(+d.minTime) })
                .append("title")
                .text(function (d) { return "Exact date: " + d.commitTime + "\n" + "Flavor: " + flavor + "\n" + "Result: " + +d.minTime + ` ${data[0].unit}`; });
        }
    }

    function plotVariable(dataGroup, color, data, x, y, flavor, taskMeasurementNumber) {
        var className = flavor + taskMeasurementNumber;
        d3.select("." + className).remove();
        if (data.length !== 0) {
            var lineGroup = dataGroup.append("g")
                .selectAll("path")
                .data([data]);

            lineGroup
                .enter()
                .append("path")
                .attr("class", className)
                .merge(lineGroup)
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 1)
                .attr("d", d3.line().curve(d3.curveMonotoneX)
                    .x(function (d) { return x(new Date(d.commitTime)); })
                    .y(function (d) { return y(+d.minTime); })
                );
        }
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

    function addLegendContent(legend, colors, flavors, taskMeasurementNumber, x, xAxis, y, yAxis, data, dataGroup) {
        for (var i = 0; i < flavors.length; i++) {
            var escapedFlavor = flavors[i].replaceAll(regex, '');
            var lineClass = ".path " + escapedFlavor + taskMeasurementNumber;
            // var circleClass = ".path " + escapedFlavor + "circleData" + taskMeasurementNumber;
            legend.append("br");
            legend.append("input")
                .attr("type", "checkbox")
                .attr("checked", "true")
                .attr("id", lineClass)
                .on("click", function () {
                    // should update on click
                    // update(dataGroup, updatedData, x, xAxis, y, yAxis, flavors, colors, taskMeasurementNumber);
                });
            legend.append("label")
                .attr("for", lineClass)
                .style("color", colors[i])
                .html(flavors[i]);
        }

    }

    function update(selection, data, x, xAxis, y, yAxis, flavors, colors, taskMeasurementNumber) {
        x.domain(d3.extent(data, function (d) { return new Date(d.commitTime); }));
        xAxis.transition().duration(1500).call(d3.axisBottom(x)
            .tickFormat(d3.timeFormat("%m/%d/%Y")));

        y.domain(d3.extent(data, function (d) { return +d.minTime; }));
        yAxis.transition().duration(1500).call(d3.axisLeft(y));

        var filteredData = mapByFlavor(data);
        console.log(filteredData);
        d3.selectAll(".xAxis .tick text")
            .attr("transform", "rotate(-15)");

        for (var i = 0; i < flavors.length; i++) {
            var escapedFlavor = flavors[i].replaceAll(regex, '');
            plotVariable(selection, colors[i], filteredData.get(flavors[i]), x, y, escapedFlavor, taskMeasurementNumber);
            circlePoints(selection, filteredData.get(flavors[i]), colors[i], x, y, flavors[i], escapedFlavor, taskMeasurementNumber);

        }
    }

    function buildGraph(allData, flavors, taskMeasurementNumber) {

        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        var startDate;
        var endDate = new Date();

        var data = getLastDaysData(allData, 14);
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

        var colors = d3.schemeCategory10;

        var x = d3.scaleTime()
            .range([0, width])
            .nice();

        var xAxis = dataGroup
            .append("g")
            .attr("class", "xAxis")
            .attr("transform", "translate(0, " + height + ")");

        var y = d3.scaleLinear()
            .range([height, 0])
            .nice();

        var yAxis = dataGroup
            .append("g")
            .attr("class", "yAxis");

        var yLegendName = addSimpleText(dataGroup, - margin.left, - margin.top, "15pt", `Results (${data[0].unit})`, "black", -90);
        var legend = addLegendBorder(collapsible);
        addLegendContent(legend, colors, flavors, taskMeasurementNumber, x, xAxis, y, yAxis, data, dataGroup);

        update(dataGroup, data, x, xAxis, y, yAxis, flavors, colors, taskMeasurementNumber);

        d3.selectAll("#startDate").on("change", function () {
            startDate = new Date(this.value);
        });

        d3.selectAll("#endDate").on("change", function () {
            endDate = new Date(this.value);
        });

        d3.selectAll("#submit").on("click", function () {
            data = getResultsBetweenDates(allData, startDate, endDate);
            update(dataGroup, data, x, xAxis, y, yAxis, flavors, colors, taskMeasurementNumber);
        });

    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.Program.loadData(measurementsUrl);
    var value = await promise;
    var data = JSON.parse(value);
    var flavors = getFlavors(data);
    for (var i = 0; i < 28; i++) {
        var testData = getWantedTestResults(data, i);
        buildGraph(testData, flavors, i);
    }
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);
}

