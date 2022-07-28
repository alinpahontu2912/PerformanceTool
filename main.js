import { App } from './app-support.js'

App.main = async function (applicationArguments) {
    App.IMPORTS.window = {
        location: {
            href: () => globalThis.window.location.href
        }
    };

    function filterFlavor(data, flavor) {
        return data.filter(test => test.flavor == flavor);
    }

    function getWantedTestResults(test, testNumber, numTests = 24) {
        var array = [];
        for (let i = testNumber; i < test.length; i += numTests) {
            array.push(test[i]);
        }
        return array;
    }


    function buildGraph(dataViz, testData) {
        const margin = { top: 30, right: 0, bottom: 30, left: 50 },
            width = 400 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        //Read the data

        // group the data: I want to draw one line per group
        const sumstat = d3.group(testData, d => d.taskname) // nest function allows to group the calculation per level of a factor
        console.log(sumstat);
        // What is the list of groups?
        const allKeys = new Set(testData.map(d => d.name))
        console.log(allKeys);
        // Add an svg element for each group. The will be one beside each other and will go on the next row when no more room available
        const svg = d3.select(dataViz)
            .selectAll("uniqueChart")
            .data(sumstat)
            .enter()
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform",
                `translate(${margin.left},${margin.top})`);

        // Add X axis --> it is a date format
        const x = d3.scaleTime()
            .domain(d3.extent(testData, function (d) { return new Date(d.dateTime); }))
            .range([0, width]);
        svg
            .append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x).ticks(3));
        //Add Y axis
        const y = d3.scaleLinear()
            .domain([0, d3.max(testData, function (d) { return +d.minTime; })])
            .range([height, 0]);
        svg.append("g")
            .call(d3.axisLeft(y).ticks(5));

        // color palette
        const color = d3.scaleOrdinal()
            //.domain(allKeys)
            .range(['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999']);

        // Draw the line
        /*svg
            .append("path")
            .attr("fill", "none")
            .attr("stroke", function (d) { return color(d[0]) })
            .attr("stroke-width", 1.9)
            .attr("d", d3.line()
                .x(function (d) { return x(new Date(d.dateTime)) })
                .y(function (d) { return y(d.minTime) }));*/
        svg.append("path")
            .datum(testData)
            .attr("fill", "none")
            .attr("stroke", function (d) { return color(d[0]) })
            .attr("stroke-width", 1.9)
            .attr("d", d3.line()
                .x(function (d) { return x(new Date(d.dateTime)) })
                .y(function (d) { return y(d.minTime) })
            )

        // Add titles
        svg
            .append("text")
            .attr("text-anchor", "start")
            .attr("y", -5)
            .attr("x", 0)
            .text(function (d) { return (d[0]) })
            .style("fill", function (d) { return color(d[0]) });



        /*const margin = { top: 10, right: 30, bottom: 30, left: 60 },
            width = 800 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        // append the svg object to the body of the Spage
        const svg = d3.select(dataViz)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleTime()
            .domain(d3.extent(testData, function (d) { return new Date(d.dateTime); }))
            .range([0, width]);
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x));

        // Add Y axis
        const y = d3.scaleLinear()
            .domain([0, d3.max(testData, function (d) { return +d.minTime; })])
            .range([height, 0]);
        svg.append("g")
            .call(d3.axisLeft(y));

        // Add the line
        svg.append("path")
            .datum(testData)
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(function (d) { return x(new Date(d.dateTime)) })
                .y(function (d) { return y(d.minTime) })
            );*/
    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.testMe();
    promise.then(value => {
        var data = JSON.parse(value);
        var wantedData = filterFlavor(data, "aot.default.chrome");
        // -14 * 24 the last tests from the past 14 days       
        var test = wantedData.slice(-336);
        console.log(test);
        // console.log(test);
        // 0 for appStart reach managed
        // var firstTry = getWantedTestResults(test, 0);
        // console.log(firstTry);
        buildGraph("#my_dataviz", test);

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

