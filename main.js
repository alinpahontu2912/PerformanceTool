import { App } from './app-support.js'

App.main = async function (applicationArguments) {
    const regex = /[^a-zA-Z]/gi;
    const measurementsUrl = "https://raw.githubusercontent.com/radekdoulik/WasmPerformanceMeasurements/main/measurements/";
    const margin = { top: 60, right: 120, bottom: 80, left: 120 };
    class TaskData {
        constructor(taskId, legendName, dataGroup, allData, x, y, xAxis, yAxis) {
            this.taskId = taskId;
            this.legendName = legendName;
            this.allData = allData;
            this.x = x;
            this.y = y;
            this.xAxis = xAxis;
            this.yAxis = yAxis;
            this.dataGroup = dataGroup;
            this.startDate = null;
            this.endDate = null;
            this.data = [];
        }
    }

    function mapByFlavor(data) {
        let obj = data.reduce((map, e) => ({
            ...map,
            [e.flavor]: [...(map[e.flavor] ?? []), e]
        }), {});
        return new Map(Object.entries(obj));
    }

    function getDataProperties(data, property) {
        let set = new Set();
        for (let i = 0; i < data.length; i++) {
            set.add(data[i][property]);
        }
        let keys = [...set];
        return keys;
    }

    function getLastDaysData(data, numOfDays) {
        let timeDif = 1000 * 60 * 60 * 24 * numOfDays;
        let lastTest = new Date(data[data.length - 1].commitTime);
        let result = data.filter(x => new Date(x.commitTime) >= lastTest - timeDif);
        return result;
    }

    function getResultsBetweenDates(allData, startDate, endDate) {
        let result = allData.filter(function (d) {
            let date = new Date(d.commitTime);
            return date.getTime() >= startDate.getTime()
                && date.getTime() <= endDate.getTime();
        });
        return result;
    }

    function circlePoints(testData, data, color, flavor, escapedFlavor) {
        let radius = 3;
        let circleGroupName = escapedFlavor + "circleData" + testData.taskId;
        let circleGroup = testData.dataGroup.append("g")
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
            .attr("r", radius)
            .attr("cx", function (d) { return testData.x(new Date(d.commitTime)); })
            .attr("cy", function (d) { return testData.y(+d.minTime) })
            .append("title")
            .text(function (d) { return "Exact date: " + d.commitTime + "\n" + "Flavor: " + flavor + "\n" + "Result: " + +d.minTime + ` ${data[0].unit}`; });

    }

    function plotVariable(testData, data, color, escapedFlavor) {
        let className = escapedFlavor + testData.taskId;
        let lineGroup = testData.dataGroup.append("g")
            .selectAll("path")
            .data([data]);

        lineGroup
            .enter()
            .append("path")
            .attr("class", className)
            .merge(lineGroup)
            .transition()
            .duration(1500)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("d", d3.line().curve(d3.curveMonotoneX)
                .x(function (d) { return testData.x(new Date(d.commitTime)); })
                .y(function (d) { return testData.y(+d.minTime); })
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

    function addLegendContent(testsData, flavors, ordinal, domName, numTests) {
        let chartParagraph = d3.select(domName);
        chartParagraph.append("h1").html("Chart Legend");
        let selection = chartParagraph.append("div");
        for (var i = 0; i < flavors.length; i++) {
            let lineClass = flavors[i];
            selection.append("br");
            selection.append("input")
                .attr("type", "checkbox")
                .attr("checked", "true")
                .attr("id", lineClass)
                .on("click", function () {
                    if (this.checked === false) {
                        for (let i = 0; i < numTests; i++) {
                            let curTest = testsData[i];
                            console.log(curTest.data);
                            curTest.data = curTest.data.filter(function (d) {
                                return d.flavor !== lineClass;
                            });
                            console.log(curTest.data);
                            let auxFlavors = Array.from(flavors);
                            auxFlavors.splice(auxFlavors.indexOf(lineClass), 1);
                            update(curTest, auxFlavors, allFlavors, ordinal);
                        }
                    }
                });
            selection.append("label")
                .attr("for", lineClass)
                .style("color", ordinal(flavors[i]))
                .html(flavors[i]);
        }

    }

    function update(testData, flavors, allFlavors, ordinal) {

        testData.x.domain(d3.extent(testData.data, function (d) { return new Date(d.commitTime); }));
        testData.xAxis.transition().duration(1500).call(d3.axisBottom(testData.x)
            .tickFormat(d3.timeFormat("%m/%d/%Y")));

        testData.y.domain(d3.extent(testData.data, function (d) { return +d.minTime; }));
        testData.yAxis.transition().duration(1500).call(d3.axisLeft(testData.y));



        d3.selectAll(".xAxis .tick text")
            .attr("transform", "rotate(-15)");

        var escapedFlavor = "";

        for (let i = 0; i < allFlavors.length; i++) {
            escapedFlavor = allFlavors[i].replaceAll(regex, '');
            let className = escapedFlavor + testData.taskId;
            d3.select("." + className).remove();
            let circleGroupName = escapedFlavor + "circleData" + testData.taskId;
            d3.select("." + circleGroupName).remove();
        }

        let filteredData = mapByFlavor(testData.data);
        for (let i = 0; i < flavors.length; i++) {
            escapedFlavor = flavors[i].replaceAll(regex, '');
            plotVariable(testData, filteredData.get(flavors[i]), ordinal(flavors[i]), escapedFlavor);
            circlePoints(testData, filteredData.get(flavors[i]), ordinal(flavors[i]), flavors[i], escapedFlavor);
        }
    }

    function buildGraph(allData, flavors, ordinal, taskId) {

        const width = 1000 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        let taskName = tasksIds[taskId];
        let data = allData.filter(d => d.taskMeasurementName === taskName);
        let collapsible = d3.select("#graphs")
            .append("details")
        collapsible.append("summary")
            .html(taskName);
        let dataGroup = collapsible
            .append("div")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        let x = d3.scaleTime()
            .range([0, width])
            .nice();

        let xAxis = dataGroup
            .append("g")
            .attr("class", "xAxis")
            .attr("transform", "translate(0, " + height + ")");

        let y = d3.scaleLinear()
            .range([height, 0])
            .nice();

        let yAxis = dataGroup
            .append("g")
            .attr("class", "yAxis");

        let yLegendName = addSimpleText(dataGroup, - margin.left, - margin.top, "15pt", `Results (${data[0].unit})`, "black", -90);
        let testData = new TaskData(taskId, yLegendName, dataGroup, data, x, y, xAxis, yAxis);
        testData.data = getLastDaysData(testData.allData, 14);
        update(testData, flavors, flavors, ordinal);
        return testData;
    }

    function updateGraphs(testsData, flavors, allFlavors, ordinal, numTests) {
        let startDate = null;
        let endDate = new Date();
        d3.selectAll("#startDate").on("change", function () {
            startDate = new Date(this.value);
        });

        d3.selectAll("#endDate").on("change", function () {
            endDate = new Date(this.value);
        });

        d3.selectAll("#submit").on("click", function () {
            if (startDate === null) {
                alert("Select start date!");
            }
            else if (startDate !== null) {
                if (startDate.getTime() >= endDate.getTime()) {
                    alert("Choose valid dates!");
                } else {
                    for (let i = 0; i < numTests; i++) {
                        let curTest = testsData[i];
                        curTest.data = getResultsBetweenDates(curTest.allData, startDate, endDate);
                        update(curTest, flavors, allFlavors, ordinal);
                    }
                }
            }
        });
    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.Program.loadData(measurementsUrl);
    var value = await promise;
    let data = JSON.parse(value);
    let allFlavors = getDataProperties(data, 'flavor');
    let tasksNames = getDataProperties(data, 'taskMeasurementName');
    let numTests = tasksNames.length;
    var tasksIds = new Map();
    tasksNames.map(function (d, i) {
        tasksIds[i] = d;
    });
    let colors = d3.schemeCategory10;
    let ordinal = d3.scaleOrdinal()
        .domain(allFlavors)
        .range(colors);
    let testsData = [];
    for (let i = 0; i < 28; i++) {
        testsData.push(buildGraph(data, allFlavors, ordinal, i));
    }
    updateGraphs(testsData, allFlavors, allFlavors, ordinal, numTests);
    addLegendContent(testsData, allFlavors, ordinal, "#chartLegend", numTests);
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);
}

