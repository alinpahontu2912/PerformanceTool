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
        const margin = { top: 10, right: 30, bottom: 30, left: 60 },
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
            .domain(d3.extent(testData, function (d) { return new Date(d.commitTime); }))
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
            .attr("stroke-width", 2.5)
            .attr("d", d3.line()
                .x(function (d) { return x(new Date(d.commitTime)) })
                .y(function (d) { return y(d.minTime) })
            );
    }

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.loadData();
    promise.then(value => {
        console.log("nothing");
        var data = JSON.parse(value);
        var wantedData = filterFlavor(data, "aot.default.chrome");
        // -14 * 24 the last tests from the past 14 days       
        var test = wantedData.slice(-336);
        // console.log(test);
        // 0 for appStart reach managed
        var firstTry = getWantedTestResults(test, 0);
        console.log(firstTry);
        buildGraph("#my_dataviz", firstTry);

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

