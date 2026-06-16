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
            <p>
                Fills <code>registration-form.pdf</code> from <code>form-data.json</code>,
                then saves the result as an editable or a flattened PDF.
            </p>
            <button disabled={disabled} onClick={async () => { await this.runDemo(() => Demos.saveBlankForm()); }}>Blank Form</button>
            <button disabled={disabled} onClick={async () => { await this.runDemo(() => Demos.fillEditable()); }}>Fill (editable)</button>
            <button disabled={disabled} onClick={async () => { await this.runDemo(() => Demos.fillAndFlatten()); }}>Fill &amp; Flatten</button>
            {this.state.demoError && <div style={{ color: "red" }}>{this.state.demoError}</div>}
        </div>
        )
    }
}

export default App
