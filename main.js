import { App } from './app-support.js'

App.main = async function (applicationArguments) {
    App.IMPORTS.window = {
        location: {
            href: () => globalThis.window.location.href
        }
    };

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

    function buildGraph(dataViz, data, keys) {
        const margin = { top: 10, right: 30, bottom: 30, left: 60 },
            width = 800 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        const svg = d3.select(dataViz)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        //Read the data

        // group the data: I want to draw one line per group
        const sumstat = d3.group(data, d => d.flavor); // nest function allows to group the calculation per level of a factor

        const allKeys = new Set(data.map(d => d.flavor))
        // Add X axis --> it is a date format
        const x = d3.scaleTime()
            .domain(d3.extent(data, function (d) { return new Date(d.commitTime); }))
            .range([0, width]);
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x).ticks(5));

        // Add Y axis
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, function (d) { return +d.minTime; })])
            .range([height, 0]);
        svg.append("g")
            .call(d3.axisLeft(y));

        // color palette
        const color = d3.scaleOrdinal()
            .range(['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'])

        // Draw the line
        svg.selectAll(".line")
            .data(sumstat)
            .join("path")
            .attr("fill", "none")
            .attr("stroke", function (d) { return color(d[0]) })
            .attr("stroke-width", 2)
            .attr("d", function (d) {
                return d3.line()
                    .x(function (d) { return x(new Date(d.commitTime)); })
                    .y(function (d) { return y(+d.minTime); })
                    (d[1])
            });

        svg.append("text")
            .attr("x", (width / 2))
            .attr("y", 10 - (margin.top / 2))
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .text(data[0].taskMeasurementName);

        // Add one dot in the legend for each name.
        svg.selectAll("mylabels")
            .data(keys)
            .enter()
            .append("text")
            .attr("x", function (d, i) { return 20 + i * 100 })
            .attr("y", height + 25)
            .style("fill", function (d) { return color(d) })
            .style("font-size", "11px")
            .text(function (d) { return d })
            .attr("text-anchor", "left")
            .style("alignment-baseline", "middle")
    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.loadData();
    promise.then(value => {
        var data = JSON.parse(value);
        var wantedData = getLastDaysData(data, 14);
        var flavors = getFlavors(data);
        // 0 for first test, meaning appStart reach managed 
        var firstTry = getWantedTestResults(wantedData, 0);
        buildGraph("#my_dataviz", firstTry, flavors);

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

