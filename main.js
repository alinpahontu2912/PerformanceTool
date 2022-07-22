import { App } from './app-support.js'

App.main = async function (applicationArguments) {
    App.IMPORTS.window = {
        location: {
            href: () => globalThis.window.location.href
        }
    };

    const exports = await App.MONO.mono_wasm_get_assembly_exports("PerformanceTool.dll");
    const promise = exports.MyClass.testMe();
    // const text = "test";
    promise.then(value => {
        console.log(value);
        document.getElementById("out").innerHTML = `${value}`;
    });
    // document.getElementById("out").innerHTML = `${promise}`;
    await App.MONO.mono_run_main("PerformanceTool.dll", applicationArguments);
}
