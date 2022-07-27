import { App } from './app-support.js'

App.main = async function (applicationArguments) {
    App.IMPORTS.window = {
        location: {
            href: () => globalThis.window.location.href
        }
    };

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.testMe();
    promise.then(value => {
        var data = JSON.parse(value);
        var xDomain = [];
        for (let i = 0; i < data.length; i++) {
            xDomain.push(data[i].taskname);
            console.log(data[i]);
        }
        console.log(xDomain);
        var name = data[0].flavor + " " + data[0].commitTime;
        console.log(name);

        const margin = { top: 10, right: 30, bottom: 30, left: 60 },
            width = 4000 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        const svg = d3.select("#my_dataviz")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(xDomain)
            .range([0, width]);
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x));

        // Add Y axis
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, function (d) { return d.minTime; })])
            .range([height, 0]);
        svg.append("g")
            .call(d3.axisLeft(y));

        // Add the line
        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(function (d) { return x(d.taskname) })
                .y(function (d) { return y(d.minTime) })
            );

    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);


}

