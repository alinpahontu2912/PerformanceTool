import { dotnet } from './dotnet.js'

async function mainJS() {
    const is_browser = typeof window != "undefined";
    if (!is_browser) throw new Error(`Expected to be running in a browser`);

    const { setModuleImports, getAssemblyExports, getConfig, runMainAndExit } = await dotnet
        .withDiagnosticTracing(false)
        .withApplicationArgumentsFromQuery()
        .create();

    const config = getConfig();
    const exports = await getAssemblyExports(config.mainAssemblyName);

    const roundAccurately = (number, decimalPlaces) => Number(Math.round(number + "e" + decimalPlaces) + "e-" + decimalPlaces);
    const regex = /[^a-zA-Z]/gi;
    const measurementsUrl = "https://raw.githubusercontent.com/radekdoulik/WasmPerformanceMeasurements/main/measurements/";
    const margin = { top: 60, right: 120, bottom: 80, left: 120 };
    const width = screen.width * 0.75 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    const greenShade = d3.scaleLinear().domain([0, 100])
        .range(["white", "darkgreen"]);
    const redShade = d3.scaleLinear().domain([0, 100])
        .range(["white", "darkred"]);
    const datePresets = ["last week", "last 14 days", "last month", "last 3 months", "whole history"];
    const colors = d3.schemeCategory10;
    var tasksIds = new Map();
    var numTests = 0;
    var firstDate = null;
    var testsData = [];


    class TaskData {
        constructor(taskId, legendName, dataGroup, allData, flavors, x, y, xAxis, xGrid, yGrid, yAxisLeft, yAxisRight) {
            this.taskId = taskId;
            this.legendName = legendName;
            this.allData = allData;
            this.x = x;
            this.y = y;
            this.xAxis = xAxis;
            this.xGrid = xGrid;
            this.yGrid = yGrid;
            this.yAxisLeft = yAxisLeft;
            this.yAxisRight = yAxisRight;
            this.dataGroup = dataGroup;
            this.brush = null;
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

    function mapByField(data, property) {
        let obj = data.reduce((map, e) => ({
            ...map,
            [e[property]]: [...(map[e[property]] ?? []), e]
        }), {});
        return new Map(Object.entries(obj));
    }

    function getResultsBetweenDates(data, startDate, endDate) {
        let result = data.filter(function (d) {
            let date = d.time;
            return date.getTime() >= startDate.getTime()
                && date.getTime() <= endDate.getTime();
        });
        return result;
    }

    function circlePoints(testData, data, color, flavor, escapedFlavor) {
        let radius = 4;
        let circleGroupName = escapedFlavor + "circleData" + testData.taskId;
        let circleGroup = testData.dataGroup.append("g")
            .attr("class", circleGroupName)
            .selectAll("circle")
            .attr("pointer-events", "all")
            .data(data);
        circleGroup
            .enter()
            .append("circle")
            .attr("fill", color)
            .attr("r", radius)
            .attr("cx", function (d) { return testData.x(d.time); })
            .attr("cy", function (d) { return testData.y(+d.minTime) })
            .attr("pointer-events", "all")
            .on("click", function (_, i) {
                window.open(i.gitLogUrl, '_blank');
            })
            .append("title")
            .text(function (d) { return "Exact date: " + d.commitTime + "\n" + "Flavor: " + flavor + "\n" + "Result: " + +d.minTime + ` ${data[0].unit}` + "\n" + "Hash: " + d.commitHash; })
            .merge(circleGroup);

    }

    function plotVariable(testData, data, color, flavor, escapedFlavor) {
        let className = escapedFlavor + testData.taskId;
        let group = testData.dataGroup.append("g");
        group.append("title").text(flavor);
        let lineGroup = group.selectAll("path")
            .data([data]);
        lineGroup
            .enter()
            .append("path")
            .on("mouseover", function () {
                d3.select(this).attr("stroke-width", 5);
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke-width", 2);
            })
            .attr("class", className)
            .merge(lineGroup)
            .transition()
            .duration(1500)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
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

    function addLegendContent(domName) {
        let chartParagraph = d3.select("#" + domName);
        let flavorsLen = flavors.length;
        for (let i = 0; i < flavorsLen; i++) {
            let lineClass = flavors[i];
            let selection = chartParagraph.append("li").append("a");
            selection.append("input")
                .attr("class", "form-check-input")
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
                            updateGraph(curTest);
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
                            updateGraph(curTest);
                        }
                    }
                    permalinkFlavors(testsData[0].availableFlavors);
                });
            selection.append("label")
                .attr("class", "form-check-label")
                .attr("for", lineClass)
                .style("color", ordinal(flavors[i]))
                .html(flavors[i]);
        }
    }

    function addSelectAllButton(domName) {
        let chartParagraph = d3.select("#" + domName);
        let selection = chartParagraph.append("li");
        selection.append("center")
            .append("button")
            .attr("class", "btn btn-block btn-primary")
            .attr("type", "submit")
            .attr("id", "legendSubmit")
            .html("Select All")
            .on("click", function () {
                updateCheckboxes(flavors);
                for (let i = 0; i < numTests; i++) {
                    let curTest = testsData[i];
                    curTest.availableFlavors = flavors;
                    curTest.data = curTest.data.concat(curTest.hiddenData);
                    curTest.hiddenData = [];
                    updateGraph(curTest);
                }
            });
    }

    function removeOldData(testData) {
        let flavorsLen = flavors.length;
        for (let i = 0; i < flavorsLen; i++) {
            let escapedFlavor = flavors[i].replaceAll(regex, '');
            let lineGroupName = escapedFlavor + testData.taskId;
            let circleGroupName = escapedFlavor + "circleData" + testData.taskId;
            d3.select("." + lineGroupName).remove();
            d3.select("." + circleGroupName).remove();
        }
    }

    function updateGraph(testData) {
        testData.x.domain(d3.extent(testData.data, function (d) { return d.time }));
        testData.xAxis.transition().duration(1500).call(d3.axisBottom(testData.x)
            .tickFormat(d3.timeFormat("%m/%d/%Y")));

        testData.y.domain(d3.extent(testData.data, function (d) { return +d.minTime; }));
        testData.yAxisLeft.transition().duration(1500).call(d3.axisLeft(testData.y));
        testData.yAxisRight.transition().duration(1500).call(d3.axisRight(testData.y));

        let xTicks = testData.x.ticks().length;
        let yTicks = testData.y.ticks().length;
        let xAxisGrid = d3.axisBottom(testData.x).tickSize(-height).tickFormat('').ticks(xTicks);
        let yAxisGrid = d3.axisLeft(testData.y).tickSize(-width).tickFormat('').ticks(yTicks);

        testData.xGrid.call(xAxisGrid);
        testData.yGrid.call(yAxisGrid);

        removeOldData(testData);

        d3.selectAll(".xAxis .tick text")
            .attr("transform", "rotate(-15)");

        let escapedFlavor = "";
        let filteredData = mapByField(testData.data, "flavor");
        let flvs = [...filteredData.keys()];
        for (let i = 0; i < flvs.length; i++) {
            escapedFlavor = flvs[i].replaceAll(regex, '');
            plotVariable(testData, filteredData.get(flvs[i]), ordinal(flvs[i]), flvs[i], escapedFlavor);
            circlePoints(testData, filteredData.get(flvs[i]), ordinal(flvs[i]), flvs[i], escapedFlavor);
        }
    }

    function addRegexText(domName) {
        d3.select("#" + domName).on("click", function () {
            let regex = document.getElementById("flavorText").value;
            regexUpdate(regex);
            document.getElementById("flavorText").value = "";
        });
    }

    function appendCollapsibles(domName, testsToTasks) {
        let tasks = [...testsToTasks.keys()].sort();
        let tasksLen = testsToTasks.size;
        for (let i = 0; i < tasksLen; i++) {
            let collapsible = d3.select("#" + domName)
                .append("details")
                .attr("id", tasks[i] + "collapsible")
                .on("click", function () {
                    let url = new URL(decodeURI(window.location));
                    let params = new URLSearchParams(url.search);
                    let openTasks = params.get("tasks");
                    if (openTasks !== null) {
                        let taskNames = openTasks.split(',');
                        if (taskNames.includes(tasks[i])) {
                            taskNames.splice(taskNames.indexOf(tasks[i]), 1);
                        } else {
                            taskNames.push(tasks[i]);
                        }
                        params.set("tasks", taskNames.join());
                    } else {
                        params.set("tasks", tasks[i]);
                    }
                    url.search = params;
                    window.history.replaceState("", "", url.toString());
                });
            collapsible.append("summary")
                .html(tasks[i]);
        }
    }

    function brushed(testData) {
        let xCoords = d3.brushSelection(testData.dataGroup.select(".brush").node());
        if (xCoords !== null) {
            let dataEnd = xCoords[1];
            let dataStart = xCoords[0];
            let brushedData = testData.data.filter(function (d) {
                return testData.x(d.time) >= dataStart && testData.x(d.time) <= dataEnd;
            });
            if (brushedData.length > 0) {
                let firstCommit = brushedData[0];
                let lastCommit = brushedData[brushedData.length - 1];
                document.getElementById("firstCommit").value = firstCommit.commitHash;
                document.getElementById("lastCommit").value = lastCommit.commitHash;
                document.getElementById("startDate").valueAsDate = firstCommit.time;
                document.getElementById("endDate").valueAsDate = lastCommit.time;
                for (let i = 0; i < numTests; i++) {
                    updateDataOnDates(testsData[i], firstCommit.time, lastCommit.time);
                    updateGraph(testsData[i]);
                }
                permalinkDates(firstCommit.time, lastCommit.time);
            }
            testData.dataGroup.select(".brush").call(testData.brush.move, null);
        }
    }

    function buildGraph(allData, flavors, taskId) {

        let taskName = tasksIds.get(taskId);
        let [task, test] = taskName.split(",");
        let data = allData.filter(d => d.taskMeasurementName === taskName);
        let collapsible = d3.select("#" + task + "collapsible");
        let dataGroup = collapsible
            .append("div")
            .append("svg")
            .attr("id", task + taskId)
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

        let xGrid = dataGroup
            .append("g")
            .attr("class", "xGrid")
            .style("stroke-dasharray", "5")
            .style("opacity", "0.3")
            .attr("transform", "translate(0, " + height + ")");

        let y = d3.scaleLinear()
            .range([height, 0])
            .nice();

        let yGrid = dataGroup
            .append("g")
            .attr("class", "yGrid")
            .style("stroke-dasharray", "5")
            .style("opacity", "0.3");

        let yAxisLeft = dataGroup
            .append("g")
            .attr("class", "yAxisLeft");

        let yAxisRight = dataGroup
            .append("g")
            .attr("class", "yAxisRight")
            .attr("transform", "translate(" + width + ",0)");

        let title = addSimpleText(dataGroup, width / 2, 10 - (margin.top / 2), "15pt", test, "black");
        let yLegendName = addSimpleText(dataGroup, - margin.left, - margin.top * 1.1, "15pt", `Results (${data[0].unit})`, "black", -90);
        let testData = new TaskData(taskId, yLegendName, dataGroup, data, Array.from(flavors), x, y, xAxis, xGrid, yGrid, yAxisLeft, yAxisRight);
        let brush = d3.brushX().on("end", () => brushed(testData)).extent([[0, 0], [width, height]]);
        dataGroup.append("g").attr("class", "brush").call(brush);
        testData.brush = brush;
        return testData;
    }

    function addCommitDiffButton(domName) {
        d3.select("#" + domName).on("click", function () {
            let firstHash = document.getElementById("firstCommit").value;
            let secondHash = document.getElementById("lastCommit").value;
            window.open("https://github.com/dotnet/runtime/compare/" + firstHash + "..." + secondHash, '_blank');
        });
    }

    function addPresets(filters, domName, callback) {
        let filtersLen = filters.length;
        let dropdownDiv = d3.select("#" + domName);
        for (let i = 0; i < filtersLen; i++) {
            dropdownDiv.append("li")
                .append("a")
                .attr("id", filters[i])
                .html(filters[i])
                .on("click", () => callback(filters[i]));
        }
    }

    function updateCheckboxes(wantedFlavors) {
        let flavorsLen = flavors.length;
        for (let i = 0; i < flavorsLen; i++) {
            if (!wantedFlavors.includes(flavors[i])) {
                document.getElementById(flavors[i]).checked = false;
            } else {
                document.getElementById(flavors[i]).checked = true
            }
        }
    }

    function updateGraphsByFlavor(wantedFlavors) {
        updateCheckboxes(wantedFlavors);
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
            curTest.availableFlavors = Array.from(wantedFlavors);
            updateGraph(curTest);
        }
    }

    function selectChartsPreset(filter) {
        let open = document.getElementById(filter + "collapsible").open;
        document.getElementById(filter + "collapsible").open = open === true ? false : true;
    }

    function selectFlavorsPreset(filter) {
        let wantedFlavors = flavors.filter(flavor => flavor.includes(filter));
        updateGraphsByFlavor(wantedFlavors);
        permalinkFlavors(wantedFlavors);
    }

    function regexUpdate(filter) {
        let wantedFlavors = flavors.filter(flavor => flavor.match(filter));
        if (wantedFlavors.length !== 0) {
            updateGraphsByFlavor(wantedFlavors);
        } else {
            alert("Invalid Regex");
        }
    }

    function selectDatePreset(filter = '') {
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
            updateDataOnDates(testsData[i], startDate, endDate);
            updateGraph(testsData[i]);
        }

        document.getElementById("startDate").valueAsDate = startDate;
        document.getElementById("endDate").valueAsDate = endDate;

        permalinkDates(startDate, endDate);
    }

    function permalinkDates(startDate, endDate) {
        let url = new URL(decodeURI(window.location));
        let params = new URLSearchParams(url.search);
        params.set("startDate", startDate.toISOString());
        params.set("endDate", endDate.toISOString());
        url.search = params;
        window.history.replaceState("", "", url.toString());
    }

    function permalinkFlavors(availableFlavors) {
        let url = new URL(decodeURI(window.location));
        let params = new URLSearchParams(url.search);
        let flavorsIndexes = availableFlavors.map(function (flavor) {
            return flavors.indexOf(flavor);
        });
        params.set("flavors", flavorsIndexes.join());
        url.search = params;
        window.history.replaceState("", "", url.toString());
    }

    function createInitialState() {
        let url = new URL(decodeURI(window.location));
        let params = new URLSearchParams(url.search);
        if (params.get("startDate") === null && params.get("endDate") === null) {
            let endDate = new Date();
            let startDate = new Date();
            startDate.setDate(endDate.getDate() - 14);
            permalinkDates(startDate, endDate);
        }
    }

    function decodeURL() {
        let url = new URL(decodeURI(window.location));
        let params = new URLSearchParams(url.search);
        let tasks = params.get("tasks");
        let startDate = new Date(params.get("startDate"));
        let endDate = new Date(params.get("endDate"));

        console.log(startDate);
        console.log(endDate);

        document.getElementById("startDate").valueAsDate = startDate;
        document.getElementById("endDate").valueAsDate = endDate;
        console.log(startDate);
        console.log(endDate);
        let urlFlavors = params.get("flavors");
        let availableFlavors = [];
        if (urlFlavors !== null) {
            urlFlavors.split(',').forEach(function (d) {
                availableFlavors.push(flavors[d]);
            });
        } else {
            availableFlavors = Array.from(flavors);
        }
        updateCheckboxes(availableFlavors);
        for (let i = 0; i < numTests; i++) {
            let curTest = testsData[i];
            curTest.availableFlavors = Array.from(availableFlavors);
            updateDataOnDates(curTest, startDate, endDate);
            updateGraph(curTest);
        }
        if (tasks !== null && tasks !== "") {
            let openTasks = tasks.split(',');
            if (openTasks[0] === "")
                openTasks.shift();
            console.log(typeof openTasks);
            console.log(openTasks);
            openTasks.forEach(task => document.getElementById(task + "collapsible").open = true);

        }
    }

    function addURLButton(domname) {
        d3.select("#" + domname)
            .on("click", function () {
                navigator.clipboard.writeText(window.location.href);
                d3.select(this).html("Copied!");
                setTimeout(_ => d3.select(this).html("Copy Permalink"), 3000);
            });
    }

    function addDatePickers(firstDatePicker, secondDatePicker, submitButton) {
        let startDate = null,
            endDate = null;

        d3.select("#" + firstDatePicker).on("change", function () {
            startDate = new Date(this.value);
        });

        d3.select("#" + secondDatePicker).on("change", function () {
            endDate = new Date(this.value);
        });

        d3.select("#" + submitButton).on("click", function () {
            if (startDate === null) {
                startDate = document.getElementById("startDate").valueAsDate;
            }
            if (endDate === null) {
                endDate = document.getElementById("endDate").valueAsDate;
            }
            if (startDate !== null && endDate !== null) {
                if (startDate.getTime() >= endDate.getTime()) {
                    alert("Choose valid dates!");
                } else {
                    for (let i = 0; i < numTests; i++) {
                        updateDataOnDates(testsData[i], startDate, endDate);
                        updateGraph(testsData[i]);
                    }
                    permalinkDates(startDate, endDate);
                }
            }
        });
    }

    function updateDataOnDates(testData, startDate, endDate) {
        testData.data = getResultsBetweenDates(testData.allData, startDate, endDate);
        testData.hiddenData = testData.data.filter(function (d) {
            return !testData.availableFlavors.includes(d.flavor);
        });
        testData.data = testData.data.filter(function (d) {
            return testData.availableFlavors.includes(d.flavor);
        });
    }

    function createTable(modalName, tableButton, taskNames) {
        d3.select("#" + tableButton).on("click", function () {
            d3.select(".table").remove();
            let table = d3.select("#" + modalName).append("table")
                .attr("id", "table")
                .attr("class", "table table-hover table-bordered");
            let wantedData = getOpenedChartsData(taskNames);
            let testsLen = wantedData.length;
            for (let i = 0; i < testsLen; i++) {
                let commits = [...mapByField(wantedData[i].data, "commitHash").keys()];
                let results = mapByField(wantedData[i].data, "flavor");
                let commitsLen = commits.length;
                let tableHead = table.append("thead")
                    .attr("class", "thead-dark text-center")
                    .append("tr");
                tableHead.append("th")
                    .attr("scope", "col")
                    .attr("class", "text-center")
                    .html(tasksIds.get(wantedData[i].taskId) + ` (${commits[0].substring(0, 7)})`);
                for (let j = 1; j < commitsLen; j++) {
                    tableHead.append("th")
                        .attr("scope", "col")
                        .attr("class", "text-center")
                        .html(commits[j].substring(0, 7));
                }
                let flavorsLen = wantedData[i].availableFlavors.length;
                let tableBody = table.append("tbody");
                for (let j = 0; j < flavorsLen; j++) {
                    let flavor = wantedData[i].availableFlavors[j];
                    let row = tableBody.append("tr");
                    row.append("th")
                        .attr("class", "text-center")
                        .attr("scope", "row")
                        .html(flavor);
                    let rowData = results.get(flavor);
                    for (let k = 1; k < commitsLen; k++) {
                        let wantedTest = rowData !== undefined ? rowData.find(function (d) {
                            return d.commitHash === commits[k];
                        }) : undefined;
                        if (wantedTest !== undefined) {
                            row.append("td")
                                .attr("class", "text-center")
                                .style("background-color", wantedTest.percentage < 0 ? greenShade((-1) * wantedTest.percentage) : redShade(wantedTest.percentage))
                                .attr("title", `Test Result: ${wantedTest.minTime} \n Percentage: ${wantedTest.percentage}`)
                                .html(`${roundAccurately(wantedTest.percentage, 3)} % `);
                        } else {
                            row.append("td")
                                .html("N/A");
                        }
                    }
                }
            }
        });
    }

    function getOpenedChartsData(taskNames) {
        let tasksLen = taskNames.length;
        let neededData = [];
        for (let i = 0; i < tasksLen; i++) {
            let isOpen = document.getElementById(taskNames[i] + "collapsible").open;
            if (isOpen === true) {
                let wantedTests = testsData.filter(function (d) {
                    return tasksIds.get(d.taskId).includes(taskNames[i]);
                });
                neededData = neededData.concat(wantedTests);
            }
        }
        return neededData;
    }

    function download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    function createMarkdown(taskNames) {
        let wantedData = getOpenedChartsData(taskNames);
        let availableTests = [];
        for (let i = 0; i < wantedData.length; i++) {
            availableTests.push(tasksIds.get(wantedData[i].taskId));
        }
        let testsLen = wantedData.length;
        let availableFlavors = JSON.stringify(wantedData[0].availableFlavors);
        let dataLength = wantedData[0].data.length - 1;
        let startDate = JSON.stringify(wantedData[0].data[0].commitTime);
        let endDate = JSON.stringify(wantedData[0].data[dataLength].commitTime);
        if (testsLen > 0) {
            let mdContent = exports.Program.CreateMarkdownText(startDate, endDate, JSON.stringify(availableTests), availableFlavors);
            let firstCommit = wantedData[0].data[0].commitHash.substring(0, 7);
            let endCommit = wantedData[testsLen - 1].data[wantedData[testsLen - 1].data.length - 1].commitHash.substring(0, 7);
            let filename = firstCommit.substring(0, 7) + "..." + endCommit.substring(0, 7) + ".md";
            return [filename, mdContent];
        } else {
            alert("No data selected");
        }
    }

    function processTime(data) {
        let dataLen = data.length;
        for (let i = 0; i < dataLen; i++) {
            data[i].time = new Date(data[i].commitTime);
        }
    }

    const promise = exports.Program.LoadData(measurementsUrl);
    let value = await promise;
    let unfilteredData = JSON.parse(value);
    let data = unfilteredData.graphPoints;
    let flavors = Array.from(unfilteredData.flavors);
    let testNames = unfilteredData.taskNames.sort();
    numTests = testNames.length;
    let graphFilters = JSON.parse(exports.Program.GetSubFlavors(JSON.stringify(flavors)));
    var testToTask = mapTestsToTasks(testNames);
    testNames.map(function (d, i) {
        tasksIds.set(i, d);
    });
    processTime(data);
    firstDate = data[0].time;
    //console.log(data);
    var ordinal = d3.scaleOrdinal()
        .domain(flavors)
        .range(colors);
    appendCollapsibles("graphs", testToTask);
    for (let i = 0; i < numTests; i++) {
        testsData.push(buildGraph(data, flavors, i));
    }
    addRegexText("regexSubmit");
    addPresets(datePresets, "datesPresets", selectDatePreset);
    addPresets(graphFilters, "flavorsPresets", selectFlavorsPreset);
    addPresets([...testToTask.keys()].sort(), "chartsPresets", selectChartsPreset);
    addLegendContent("chartLegend");
    addSelectAllButton("chartLegend")
    addDatePickers("startDate", "endDate", "submit");
    addCommitDiffButton("commitsSubmit");
    createTable("modalBody", "tableButton", [...testToTask.keys()].sort());
    document.getElementById("markDownButton").addEventListener("click", function () {
        let [filename, text] = createMarkdown([...testToTask.keys()].sort());
        download(filename, text);
    });
    addURLButton("copyURL");
    createInitialState();
    decodeURL();
    document.querySelector("#loadingCircle").style.display = 'none';
    document.querySelector("#main").style.display = '';

    console.log("end of mainJS: " + (new Date().getTime() - startTime));

    await runMainAndExit(config.mainAssemblyName, []);
}

await mainJS();
