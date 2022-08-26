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

    function mapTestsToTasks(testNames) {
        let testsMap = new Map();
        for (let i = 0; i < numTests; i++) {
            let [task, test] = testNames[i].split(",")
            if (!testsMap.has(task)) {
                testsMap.set(task, []);
            }
            testsMap.get(task).push(test);
        }
        return testsMap;
    }

    function getFirstTestDate(data) {
        let datesArray = data.map(d => d.time);
        return new Date(Math.min(...datesArray));
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
        let lastTest = new Date();
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

    function addLegendContent(testsData, flavors, domName) {
        let chartParagraph = d3.select("#" + domName);
        chartParagraph.append("h2").html("Chart Legend");
        let selection = chartParagraph.append("div");
        let flavorsLen = flavors.length;
        for (let i = 0; i < flavorsLen; i++) {
            let lineClass = flavors[i];
            selection.append("input")
                .attr("type", "checkbox")
                .attr("checked", "true")
                .attr("id", lineClass)
                .on("change", function () {
                    if (this.checked === false) {
                        for (let i = 0; i < numTests; i++) {
                            let curTest = testsData[i];
                            let flavorResults = curTest.data.filter(function (d) {
                                return d.flavor === lineClass;
                            });
                            curTest.hiddenData = curTest.hiddenData.concat(flavorResults);
                            curTest.data = curTest.data.filter(function (d) {
                                return !flavorResults.includes(d);
                            });
                            curTest.availableFlavors.splice(curTest.availableFlavors.indexOf(lineClass), 1);
                            updateGraph(curTest, flavors);
                        }
                    } else {
                        for (let i = 0; i < numTests; i++) {
                            let curTest = testsData[i];
                            let flavorResults = curTest.hiddenData.filter(function (d) {
                                return d.flavor === lineClass;
                            });
                            curTest.data = curTest.data.concat(flavorResults);
                            curTest.availableFlavors.push(lineClass);
                            curTest.hiddenData = curTest.hiddenData.filter(function (d) {
                                return !flavorResults.includes(d);
                            });
                            updateGraph(curTest, flavors);
                        }
                    }
                });
            selection.append("label")
                .attr("for", lineClass)
                .style("color", ordinal(flavors[i]))
                .html(flavors[i])
                .append("br");
        }

    }

    function removeOldData(testData, flavors) {
        let flavorsLen = flavors.length;
        for (let i = 0; i < flavorsLen; i++) {
            let escapedFlavor = flavors[i].replaceAll(regex, '');
            let className = escapedFlavor + testData.taskId;
            d3.select("." + className).remove();
            let circleGroupName = escapedFlavor + "circleData" + testData.taskId;
            d3.select("." + circleGroupName).remove();
        }
    }

    function updateGraph(testData, flavors) {

        testData.x.domain(d3.extent(testData.data, function (d) { return d.time }));
        testData.xAxis.transition().duration(1500).call(d3.axisBottom(testData.x)
            .tickFormat(d3.timeFormat("%m/%d/%Y")));

        testData.y.domain(d3.extent(testData.data, function (d) { return +d.minTime; }));
        testData.yAxis.transition().duration(1500).call(d3.axisLeft(testData.y));

        d3.selectAll(".xAxis .tick text")
            .attr("transform", "rotate(-15)");

        removeOldData(testData, flavors)
        let escapedFlavor = "";
        let filteredData = mapByFlavor(testData.data);
        let flvs = testData.availableFlavors;
        for (let i = 0; i < flvs.length; i++) {
            escapedFlavor = flvs[i].replaceAll(regex, '');
            plotVariable(testData, filteredData.get(flvs[i]), ordinal(flvs[i]), escapedFlavor);
            circlePoints(testData, filteredData.get(flvs[i]), ordinal(flvs[i]), flvs[i], escapedFlavor);
        }
    }

    function addRegexText(domName) {
        d3.select("#" + domName).on("click", function () {
            let regex = document.getElementById("flavorText").value;
            regexUpdate(testsData, flavors, regex);
            document.getElementById("flavorText").value = "";
        });
    }

    function appendCollapsibles(domName, testsToTasks) {
        let tasks = [...testsToTasks.keys()].sort();
        let tasksLen = testsToTasks.size;
        for (let i = 0; i < tasksLen; i++) {
            let collapsible = d3.select("#" + domName)
                .append("details")
                .attr("id", tasks[i] + "collapsible");
            collapsible.append("summary")
                .html(tasks[i]);
        }
    }

    function buildGraph(allData, flavors, taskId) {

        const width = 1000 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        let taskName = tasksIds[taskId];
        let [task, test] = taskName.split(",");
        let data = allData.filter(d => d.taskMeasurementName === taskName);
        let collapsible = d3.select("#" + task + "collapsible");
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
        let title = addSimpleText(dataGroup, width / 2, 10 - (margin.top / 2), "15pt", test, "black");
        let yLegendName = addSimpleText(dataGroup, - margin.left, - margin.top, "15pt", `Results (${data[0].unit})`, "black", -90);
        let testData = new TaskData(taskId, yLegendName, dataGroup, data, Array.from(flavors), x, y, xAxis, yAxis);
        testData.data = getLastDaysData(testData.allData, 14);
        return testData;
    }

    function createNewDropDown(presetName, domName) {
        let dropdown = d3.select("#" + domName)
            .append("div")
            .attr("class", "dropdown");
        dropdown.append("button")
            .attr("class", "dropbtn")
            .html(presetName);
        let dropdownDiv = dropdown.append("div")
            .attr("class", "dropdown-content");
        return dropdownDiv;
    }

    function addPresets(presetName, filters, domName, testsData, flavors, callback) {
        let dropdownDiv = createNewDropDown(presetName, domName);
        let filtersLen = filters.length;
        for (let i = 0; i < filtersLen; i++) {
            dropdownDiv.append("p")
                .attr("id", filters[i])
                .html(filters[i])
                .on("click", () => callback(testsData, flavors, filters[i]));
        }
        dropdownDiv.append("br");
    }

    function updateCheckboxes(allFlavors, wantedFlavors) {
        let allFlavorsLen = allFlavors.length;
        for (let i = 0; i < allFlavorsLen; i++) {
            if (!wantedFlavors.includes(allFlavors[i])) {
                document.getElementById(allFlavors[i]).checked = false;
            } else {
                document.getElementById(allFlavors[i]).checked = true
            }
        }
    }

    function addSelectAllButton(domName, flavors) {
        d3.select("#" + domName).on("click", function () {
            let filtersLen = flavors.length;
            for (let i = 0; i < filtersLen; i++) {
                if (document.getElementById(flavors[i]).checked === false) {
                    document.getElementById(flavors[i]).click();
                }
            }
        });
    }

    function updateDataByFlavor(testsData, flavors, wantedFlavors) {
        updateCheckboxes(flavors, wantedFlavors);
        for (let i = 0; i < numTests; i++) {
            let curTest = testsData[i];
            curTest.data = curTest.data.concat(curTest.hiddenData);
            curTest.hiddenData.length = 0;
            let flavorResults = curTest.data.filter(function (d) {
                return !wantedFlavors.includes(d.flavor);
            });
            curTest.hiddenData = flavorResults;
            curTest.data = curTest.data.filter(function (d) {
                return wantedFlavors.includes(d.flavor);
            });
            curTest.availableFlavors.length = 0;
            curTest.availableFlavors = Array.from(wantedFlavors);
            updateGraph(curTest, flavors);
        }
    }

    function chartsPreset(testsData, flavors, filter) {
        let open = document.getElementById(filter + "collapsible").open;
        document.getElementById(filter + "collapsible").open = open === true ? false : true;
    }

    function flavorsPreset(testsData, flavors, filter) {
        let wantedFlavors = flavors.filter(flavor => flavor.includes(filter));
        updateDataByFlavor(testsData, flavors, wantedFlavors);
    }

    function regexUpdate(testsData, flavors, filter) {
        let wantedFlavors = flavors.filter(flavor => flavor.match(filter));
        if (wantedFlavors.length !== 0) {
            updateDataByFlavor(testsData, flavors, wantedFlavors);
        } else {
            alert("Invalid Regex");
        }

    }

    function datesPreset(testsData, flavors, filter = '') {
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
                startDate = firstDate;
                break;
            default:
                startDate.setDate(endDate.getDate() - 14);
                break;
        }

        for (let i = 0; i < numTests; i++) {
            updateTestDataOnDates(testsData[i], startDate, endDate);
            updateGraph(testsData[i], flavors);
        }

        document.getElementById('startDate').valueAsDate = startDate;
        document.getElementById('endDate').valueAsDate = endDate;
    }

    function updateOnDatePicker(testsData, flavors) {
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
                    for (let i = 0; i < numTests; i++) {
                        updateTestDataOnDates(testsData[i], startDate, endDate);
                        updateGraph(testsData[i], flavors);
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
    let dataLen = data.length;
    for (let i = 0; i < dataLen; i++) {
        data[i].time = new Date(data[i].commitTime);
    }

    let flavors = getDataProperties(data, 'flavor');
    let testNames = getDataProperties(data, 'taskMeasurementName');
    let datePresets = ["last week", "last 14 days", "last month", "last 3 months", "whole history"];
    let graphFilters = getContentFromFlavor(flavors);
    var firstDate = getFirstTestDate(data);
    var numTests = testNames.length;
    var tasksIds = new Map();
    const testToTask = mapTestsToTasks(testNames);
    testNames.map(function (d, i) {
        tasksIds[i] = d;
    });
    let colors = d3.schemeCategory10;
    var ordinal = d3.scaleOrdinal()
        .domain(flavors)
        .range(colors);
    let testsData = [];
    appendCollapsibles("graphs", testToTask);
    for (let i = 0; i < numTests; i++) {
        testsData.push(buildGraph(data, flavors, i));
    }

    addRegexText("regexSubmit");
    addSelectAllButton("selectAll", flavors);
    addPresets("Date Presets", datePresets, "attachDropdown", testsData, flavors, datesPreset);
    addPresets("Flavor Presets", graphFilters, "attachDropdown", testsData, flavors, flavorsPreset);
    addPresets("Charts Presets", [...testToTask.keys()], "attachDropdown", [], [], chartsPreset);

    addLegendContent(testsData, flavors, "chartLegend");
    updateOnDatePicker(testsData, flavors);
    datesPreset(testsData, flavors);

    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);
}
