import { Component } from "react";
import { Demos } from "./Demos";

interface State {
    loading: boolean,
    error: boolean,
    demoError: string
}

export class App extends Component<{}, State> {

    constructor(props: {}) {
        super(props);
        this.state = { loading: true, error: false, demoError: "" };
    }

    async componentDidMount() {
        if (await Demos.connect())
            this.setState({ loading: false, error: false });
        else
            this.setState({ loading: false, error: true });
    }

    componentWillUnmount() {
        Demos.disconnect();
    }

    // runs a demo method, showing any errors on the page
    async runDemo(demo: () => Promise<void>) {
        this.setState({ demoError: "" });
        try {
            await demo();
        } catch (e) {
            this.setState({ demoError: e instanceof Error ? e.message : String(e) });
        }
    }

    render() {
        let s, disabled;
        if (this.state.error) {
            s = "DsPdfJS initialization error...";
            disabled = true;
        } else if (this.state.loading) {
            s = "DsPdfJS loading..."
            disabled = true;
        } else {
            s = `Loaded DsPdfJS version ${Demos.apiVersion}`;
            disabled = false;
        }
        return (
        <div>
            <div>{s}</div>
            <button disabled={disabled} onClick={async () => { await this.runDemo(() => Demos.simplePdf()); }}>Simple PDF</button>
            <button disabled={disabled} onClick={async () => { await this.runDemo(() => Demos.drawPdf()); }}>Draw PDF</button>
            <button disabled={disabled} onClick={async () => { await this.runDemo(() => Demos.drawSvg()); }}>Draw SVG</button>
            <button disabled={disabled} onClick={async () => { await this.runDemo(() => Demos.drawPng()); }}>Draw PNG</button>
            {this.state.demoError && <div style={{ color: "red" }}>{this.state.demoError}</div>}
        </div>
        )
    }
}

export default App
