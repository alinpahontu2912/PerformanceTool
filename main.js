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
        var data = d3.csvParse(value);
        console.log(typeof data);
        for (let i = 0; i < data.length; i++) {
            console.log(data[i]);
        }
    });
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);

    
}

