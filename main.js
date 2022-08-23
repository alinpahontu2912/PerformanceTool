import { App } from './app-support.js'

App.main = async function (applicationArguments) {
    const regex = /[^a-zA-Z]/gi;
    const measurementsUrl = "https://raw.githubusercontent.com/radekdoulik/WasmPerformanceMeasurements/main/measurements/";
    const margin = { top: 60, right: 120, bottom: 80, left: 120 };
    class TaskData {
        constructor(taskId, legendName, dataGroup, allData, flavors, x, y, xAxis, yAxis) {
            this.taskId = taskId;
            this.legendName = legendName;
            this.allData = allData;
            this.x = x;
            this.y = y;
            this.xAxis = xAxis;
            this.yAxis = yAxis;
            this.dataGroup = dataGroup;
            this.data = [];
            this.hiddenData = [];
            this.availableFlavors = flavors;
        }
    }

    function getContentFromFlavor(flavors) {
        let set = new Set();
        flavors.forEach(function (flavor) {
            let values = flavor.split(".");
            values.forEach(value => set.add(value));
        });
        let keys = [...set];
        return keys;
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
        data.forEach(d => set.add(d[property]));
        let keys = [...set];
        return keys;
    }

    function getLastDaysData(data, numOfDays) {
        let timeDif = 1000 * 60 * 60 * 24 * numOfDays;
        let lastTest = data[data.length - 1].time;
        let result = data.filter(x => x.time >= lastTest - timeDif);
        return result;
    }

    function getResultsBetweenDates(allData, startDate, endDate) {
        let result = allData.filter(function (d) {
            let date = d.time;
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
            .attr("cx", function (d) { return testData.x(d.time); })
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
                .x(function (d) { return testData.x(d.time); })
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

    function addLegendContent(testsData, flavors, ordinal, domName) {
        let chartParagraph = d3.select(domName);
        chartParagraph.append("h1").html("Chart Legend");
        let selection = chartParagraph.append("div");
        for (let i = 0; i < flavors.length; i++) {
            let lineClass = flavors[i];
            selection.append("br");
            selection.append("input")
                .attr("type", "checkbox")
                .attr("checked", "true")
                .attr("id", lineClass)
                .on("click", function () {
                    if (this.checked === false) {
                        for (let i = 0; i < testsData.length; i++) {
                            let curTest = testsData[i];
                            let flavorResults = curTest.data.filter(function (d) {
                                return d.flavor === lineClass;
                            });
                            curTest.hiddenData = curTest.hiddenData.concat(flavorResults);
                            curTest.data = curTest.data.filter(function (d) {
                                return !flavorResults.includes(d);
                            });
                            curTest.availableFlavors.splice(curTest.availableFlavors.indexOf(lineClass), 1);
                            updateGraph(curTest, flavors, ordinal);
                        }
                    } else {
                        for (let i = 0; i < testsData.length; i++) {
                            let curTest = testsData[i];
                            let flavorResults = curTest.hiddenData.filter(function (d) {
                                return d.flavor === lineClass;
                            });
                            curTest.data = curTest.data.concat(flavorResults);
                            curTest.availableFlavors.push(lineClass);

                            curTest.hiddenData = curTest.hiddenData.filter(function (d) {
                                return !flavorResults.includes(d);
                            });
                            updateGraph(curTest, flavors, ordinal);
                        }
                    }
                });
            selection.append("label")
                .attr("for", lineClass)
                .style("color", ordinal(flavors[i]))
                .html(flavors[i]);
        }

    }

    function updateGraph(testData, flavors, ordinal) {

        testData.x.domain(d3.extent(testData.data, function (d) { return d.time }));
        testData.xAxis.transition().duration(1500).call(d3.axisBottom(testData.x)
            .tickFormat(d3.timeFormat("%m/%d/%Y")));

        testData.y.domain(d3.extent(testData.data, function (d) { return +d.minTime; }));
        testData.yAxis.transition().duration(1500).call(d3.axisLeft(testData.y));

        d3.selectAll(".xAxis .tick text")
            .attr("transform", "rotate(-15)");

        var escapedFlavor = "";

        for (let i = 0; i < flavors.length; i++) {
            escapedFlavor = flavors[i].replaceAll(regex, '');
            let className = escapedFlavor + testData.taskId;
            d3.select("." + className).remove();
            let circleGroupName = escapedFlavor + "circleData" + testData.taskId;
            d3.select("." + circleGroupName).remove();
        }

        let filteredData = mapByFlavor(testData.data);
        let flvs = testData.availableFlavors;
        for (let i = 0; i < flvs.length; i++) {
            escapedFlavor = flvs[i].replaceAll(regex, '');
            plotVariable(testData, filteredData.get(flvs[i]), ordinal(flvs[i]), escapedFlavor);
            circlePoints(testData, filteredData.get(flvs[i]), ordinal(flvs[i]), flvs[i], escapedFlavor);
        }
    }

    function buildGraph(allData, flavors, ordinal, taskId) {

        const width = 800 - margin.left - margin.right;
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
        let testData = new TaskData(taskId, yLegendName, dataGroup, data, Array.from(flavors), x, y, xAxis, yAxis);
        testData.data = getLastDaysData(testData.allData, 14);
        updateGraph(testData, flavors, ordinal);
        return testData;
    }

    function createNewDropDown(presetName, domName) {
        let dropdown = d3.select(domName);
        dropdown.append("button")
            .attr("class", "dropbtn")
            .html(presetName);
        let dropdownDiv = dropdown.append("div")
            .attr("class", "dropdown-content");
        return dropdownDiv;
    }

    function addDatePresets(presetName, filters, domName, testsData, flavors, ordinal) {
        let dropdownDiv = createNewDropDown(presetName, domName);
        for (let i = 0; i < filters.length; i++) {
            dropdownDiv.append("p")
                .attr("id", filters[i])
                .html(filters[i])
                .on("click", () => updateOnDatesPreset(testsData, flavors, ordinal, filters[i]));
        }
        dropdownDiv.append("br");
    }

    function addGraphPresets(presetName, filters, domName, testsData, flavors, ordinal) {
        let dropdownDiv = createNewDropDown(presetName, domName);
        for (let i = 0; i < filters.length; i++) {
            dropdownDiv.append("p")
                .attr("id", filters[i])
                .html(filters[i])
                .on("click", () => updateOnFiltersPreset(testsData, flavors, ordinal, filters[i]));
        }
        dropdownDiv.append("br");
    }
    function updateOnFiltersPreset(testsData, flavors, ordinal, filter) {
        let wantedFlavors = flavors.filter(flavor => flavor.includes(filter));
        console.log(wantedFlavors);
        wantedFlavors.forEach(x => console.log(d3.selectAll(x)));

    }

    function updateOnDatesPreset(testsData, flavors, ordinal, filter) {
        let startDate = new Date();
        let endDate = new Date();

        switch (filter) {
            case "last week":
                startDate.setDate(endDate.getDate() - 7);
                break;
            case "last 14 days":
                startDate.setDate(endDate.getDate() - 14);
                break;
            case "last month":
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            case "last 3 months":
                startDate.setMonth(endDate.getMonth() - 3);
                break;
            case "whole history":
                startDate.setDate(0);
                break;
            default:
                break;
        }

        for (let i = 0; i < testsData.length; i++) {
            updateTestDataOnDates(testsData[i], startDate, endDate);
            updateGraph(testsData[i], flavors, ordinal);
        }

        d3.select("#startDate").transition().valueAsDate = startDate;
        console.log(d3.select("#startDate"));

        $('#startDate').value = startDate.toISOString().split('T')[0];
        $('#endDate').value = endDate.toISOString().split('T')[0];
    }

    function updateOnDatePicker(testsData, flavors, ordinal) {
        let startDate = null;
        let endDate = null;

        d3.select("#startDate").on("change", function () {
            startDate = new Date(this.value);
        });

        d3.select("#endDate").on("change", function () {
            endDate = new Date(this.value);
        });

        d3.select("#submit").on("click", function () {
            if (startDate === null) {
                alert("Select start date!");
            }
            else if (startDate !== null && endDate !== null) {
                if (startDate.getTime() >= endDate.getTime()) {
                    alert("Choose valid dates!");
                } else {
                    for (let i = 0; i < testsData.length; i++) {
                        let curTest = testsData[i];
                        updateTestDataOnDates(curTest, startDate, endDate);
                        updateGraph(curTest, flavors, ordinal);
                    }
                }
            }
        });
    }

    function updateTestDataOnDates(testData, startDate, endDate) {
        testData.data = getResultsBetweenDates(testData.allData, startDate, endDate);
        testData.hiddenData = testData.data.filter(function (d) {
            return !testData.availableFlavors.includes(d.flavor);
        });
        testData.data = testData.data.filter(function (d) {
            return testData.availableFlavors.includes(d.flavor);
        });
    }


    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.Program.loadData(measurementsUrl);
    var value = await promise;
    let data = JSON.parse(value);
    data.forEach(
        function (d) {
            d.time = new Date(d.commitTime);
        }
    );
    let flavors = getDataProperties(data, 'flavor');
    let tasksNames = getDataProperties(data, 'taskMeasurementName');
    let numTests = tasksNames.length;
    var tasksIds = new Map();
    tasksNames.map(function (d, i) {
        tasksIds[i] = d;
    });
    let colors = d3.schemeCategory10;
    let ordinal = d3.scaleOrdinal()
        .domain(flavors)
        .range(colors);
    let testsData = [];
    for (let i = 0; i < numTests; i++) {
        testsData.push(buildGraph(data, flavors, ordinal, i));
    }
    let datePresets = ["last week", "last 14 days", "last month", "last 3 months", "whole history"];
    let graphFilters = getContentFromFlavor(flavors);
    addDatePresets("Date Presets", datePresets, "#dropdown", testsData, flavors, ordinal);
    updateOnDatePicker(testsData, flavors, ordinal);
    addLegendContent(testsData, flavors, ordinal, "#chartLegend");

    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);
}

