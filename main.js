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
    const width = screen.width * 0.8 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
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

    function mapByField(data, property) {
        let obj = data.reduce((map, e) => ({
            ...map,
            [e[property]]: [...(map[e[property]] ?? []), e]
        }), {});
        return new Map(Object.entries(obj));
    }

    function getDataProperties(data, property) {
        let set = new Set();
        data.forEach(d => set.add(d[property]));
        let keys = [...set];
        return keys;
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
                });
            selection.append("label")
                .attr("class", "form-check-label")
                .attr("for", lineClass)
                .style("color", ordinal(flavors[i]))
                .html(flavors[i]);
        }
        let selection = chartParagraph.append("li");
        selection.append("button")
            .attr("class", "btn btn-block btn-primary")
            .attr("type", "submit")
            .attr("id", "legendSubmit")
            .html("Select All")
            .on("click", function () {
                for (let i = 0; i < flavors.length; i++) {
                    if (document.getElementById(flavors[i]).checked === false) {
                        document.getElementById(flavors[i]).click();
                    }
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
                .attr("id", tasks[i] + "collapsible");
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
                document.getElementById("secondCommit").value = lastCommit.commitHash;
                document.getElementById("startDate").valueAsDate = firstCommit.time;
                document.getElementById("endDate").valueAsDate = lastCommit.time;
                for (let i = 0; i < numTests; i++) {
                    updateDataOnDates(testsData[i], firstCommit.time, lastCommit.time);
                    updateGraph(testsData[i]);
                }
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
            let secondHash = document.getElementById("secondCommit").value;
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

    function updateGraphsByFlavor(wantedFlavors) {
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
    }

    function addDatePickers(firstDatePicker, secondDatePicker, submitButton) {
        let startDate = null;
        let endDate = null;

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
            let wantedData = getWantedData(taskNames);
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
                        let wantedTest = rowData.find(function (d) {
                            return d.commitHash === commits[k];
                        });
                        if (wantedTest !== undefined) {
                            row.append("td")
                                .attr("class", "text-center")
                                .style("background-color", wantedTest.percentage < 0 ? greenShade((-1) * wantedTest.percentage) : redShade(wantedTest.percentage))
                                .attr("title", `Test Result: ${wantedTest.minTime}`)
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

    function getWantedData(taskNames) {
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
        let wantedData = getWantedData(taskNames);
        let markDown = [];
        let testsLen = wantedData.length;
        if (testsLen > 0) {
            let availableFlavors = wantedData[0].availableFlavors;
            let availableFlavorsLen = availableFlavors.length;
            for (let i = 0; i < testsLen; i++) {
                let commits = [...mapByField(wantedData[i].data, "commitHash").keys()];
                let results = mapByField(wantedData[i].data, "flavor");
                let commitsLen = commits.length;
                markDown.push("|");
                markDown.push(tasksIds.get(wantedData[i].taskId));
                markDown.push(`(${commits[0].substring(0, 7)})`);
                markDown.push("|");
                for (let j = 1; j < commitsLen; j++) {
                    markDown.push(commits[j].substring(0, 7));
                    markDown.push("|");
                }
                markDown.push('\n');
                for (let j = 0; j < commitsLen; j++) {
                    markDown.push("|-:");
                }
                markDown.push("|");
                markDown.push('\n');
                for (let j = 0; j < availableFlavorsLen; j++) {
                    markDown.push("|");
                    markDown.push(availableFlavors[j]);
                    markDown.push("|");
                    let rowData = results.get(availableFlavors[j]);
                    for (let k = 1; k < commitsLen; k++) {
                        let wantedTest = rowData.find(function (d) {
                            return d.commitHash === commits[k];
                        });
                        if (wantedTest !== undefined) {
                            markDown.push(roundAccurately(wantedTest.percentage, 3).toString() + "%");
                        } else {
                            markDown.push("N/A");
                        }
                        markDown.push("|");
                    }
                    markDown.push('\n');
                }
                markDown.push('\n');
            }
            let firstCommit = wantedData[0].data[0].commitHash.substring(0, 7);
            let endCommit = wantedData[testsLen - 1].data[wantedData[testsLen - 1].data.length - 1].commitHash.substring(0, 7);
            let filename = firstCommit.substring(0, 7) + "..." + endCommit.substring(0, 7) + ".md";
            return [filename, markDown.join('')];
        } else {
            alert("No data selected");
        }
    }

    function processData(data, flavors) {
        let tests = mapByField(data, "taskMeasurementName");
        for (let i = 0; i < numTests; i++) {
            let task = tests.get(tasksIds.get(i));
            let flavorTests = mapByField(task, "flavor");
            for (let j = 0; j < flavors.length; j++) {
                let curTest = flavorTests.get(flavors[j]);
                let curTestLength = curTest.length;
                curTest[0].percentge = 0;
                curTest[0].time = new Date(curTest[0].commitTime);
                for (let k = 1; k < curTestLength; k++) {
                    curTest[k].time = new Date(curTest[k].commitTime);
                    curTest[k].percentage = (-1) * (curTest[k - 1].minTime - curTest[k].minTime) / curTest[k - 1].minTime * 100;
                }
            }
        }
    }

    const promise = exports.Program.loadData(measurementsUrl);
    var value = await promise;
    let data = JSON.parse(value);
    let flavors = getDataProperties(data, "flavor");
    let testNames = getDataProperties(data, "taskMeasurementName");
    let datePresets = ["last week", "last 14 days", "last month", "last 3 months", "whole history"];
    let graphFilters = getContentFromFlavor(flavors);
    var numTests = testNames.length;
    var tasksIds = new Map();
    const testToTask = mapTestsToTasks(testNames);
    testNames.map(function (d, i) {
        tasksIds.set(i, d);
    });
    var greenShade = d3.scaleLinear().domain([0, 100])
        .range(["white", "darkgreen"]);
    var redShade = d3.scaleLinear().domain([0, 100])
        .range(["white", "darkred"]);
    processData(data, flavors);
    var firstDate = getFirstTestDate(data);
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
    addPresets(datePresets, "datesPresets", selectDatePreset);
    addPresets(graphFilters, "flavorsPresets", selectFlavorsPreset);
    addPresets([...testToTask.keys()].sort(), "chartsPresets", selectChartsPreset);
    addLegendContent("chartLegend");
    addDatePickers("startDate", "endDate", "submit");
    selectDatePreset();
    addCommitDiffButton("commitsSubmit");
    createTable("modalBody", "tableButton", [...testToTask.keys()].sort());
    document.getElementById("markDownButton").addEventListener("click", function () {
        let [filename, text] = createMarkdown([...testToTask.keys()].sort());
        download(filename, text);
    });
    document.querySelector("#loadingCircle").style.display = 'none';
    document.querySelector("#main").style.display = '';

    await runMainAndExit(config.mainAssemblyName, []);
}

await mainJS();
