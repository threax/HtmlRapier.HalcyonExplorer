import * as controller from 'hr.controller';
import * as PageStart from 'hr.halcyon-explorer.HalApiBrowserStart';
import * as HalClient from 'hr.halcyon.EndpointClient';
import * as iter from 'hr.iterable';
import * as jsonEditor from 'hr.halcyon-explorer.json-editor-plugin';

interface HalLinkDisplay {
    href: string,
    rel: string,
    method: string,
    getClient(): HalClient.HalEndpointClient;
}

interface HalDataDisplay {
    raw: string
}

interface HalRequestData {
    jsonData: string;
}

interface HalEndpointDoc {
    requestSchema: any,
    responseSchema: any,
    querySchema: any,
}

var defaultError = { path: null };

export class LinkController {
    public static Builder(parentController: HalcyonBrowserController) {
        return new controller.ControllerBuilder<LinkController, HalcyonBrowserController, HalLinkDisplay>(LinkController, parentController);
    }

    private rel: string;
    private method: string;
    private parentController: HalcyonBrowserController;
    private client: HalClient.HalEndpointClient;
    private formModel = null;
    private jsonEditor;
    private currentError: Error = null;
    private isQueryForm: boolean;

    constructor(bindings: controller.BindingCollection, parentController: HalcyonBrowserController, link: HalLinkDisplay) {
        this.rel = link.rel;
        this.parentController = parentController;
        this.client = link.getClient();
        this.method = link.method;

        if (this.client.HasLinkDoc(this.rel)) {
            this.client.LoadLinkDoc(this.rel)
                .then(docClient => {
                    var doc = docClient.GetData<HalEndpointDoc>();
                    if (doc.requestSchema) {
                        this.formModel = jsonEditor.create<any>(bindings.getHandle("editorHolder"), {
                            schema: doc.requestSchema,
                            disable_edit_json: true,
                            disable_properties: true,
                            disable_collapse: true,
                            show_errors: "always",
                            custom_validators: [
                                (schema, value, path) => this.showCurrentErrorValidator(schema, value, path)
                            ],
                        });
                        this.jsonEditor = this.formModel.getEditor();
                        this.formModel.setData(this.client.GetData());
                        this.isQueryForm = false;
                    }
                    else if (doc.querySchema) {
                        this.formModel = jsonEditor.create<any>(bindings.getHandle("editorHolder"), {
                            schema: doc.querySchema,
                            disable_edit_json: true,
                            disable_properties: true,
                            disable_collapse: true,
                            show_errors: "always",
                            custom_validators: [
                                (schema, value, path) => this.showCurrentErrorValidator(schema, value, path)
                            ],
                        });
                        this.jsonEditor = this.formModel.getEditor();
                        this.isQueryForm = true;
                    }
                });
        }
    }

    submit(evt) {
        evt.preventDefault();
        var promise;
        if (this.formModel != null) {
            var data = this.formModel.getData();

            if (this.isQueryForm) {
                promise = this.client.LoadLinkWithQuery(this.rel, data);
            }
            else {
                promise = this.client.LoadLinkWithBody(this.rel, data);
            }
        }
        else{
            promise = this.client.LoadLink(this.rel);
        }

        promise.then(result => {
            this.parentController.showResults(result);
        })
        .catch(err => {
            this.currentError = err;
            if (this.jsonEditor) {
                this.jsonEditor.onChange();
            }
            else {
                alert('Error completing request. Message: ' + err.message);
            }
        });
    }

    private showCurrentErrorValidator(schema, value, path): any {
        if (this.currentError !== null) {
            if (path === "root") {
                return {
                    path: path,
                    message: this.currentError.message
                }
            }

            if (this.currentError instanceof HalClient.HalError) {
                var halError = <HalClient.HalError>this.currentError;

                //walk path to error
                var shortPath = this.errorPath(path);
                var errorMessage = halError.getValidationError(shortPath);
                if (errorMessage !== undefined) {
                    //Listen for changes on field
                    //this.fieldWatcher.watch(path, shortPath, this.currentError);
                    return {
                        path: path,
                        message: errorMessage
                    };
                }
            }
        }
        return defaultError;
    }

    private errorPath(path) {
        return path.replace('root.', '');
    }
}

export class HalcyonBrowserController {
    public static Builder() {
        return new controller.ControllerBuilder<HalcyonBrowserController, void, void>(HalcyonBrowserController);
    }

    private linkModel: controller.Model<HalLinkDisplay>;
    private embedsModel: controller.Model<HalClient.Embed>;
    private dataModel: controller.Model<any>;
    private client: HalClient.HalEndpointClient;

    constructor(bindings: controller.BindingCollection) {
        this.linkModel = bindings.getModel<HalLinkDisplay>("links");
        this.embedsModel = bindings.getModel<HalClient.Embed>("embeds");
        this.dataModel = bindings.getModel<any>("data");
    }

    showResults(client: HalClient.HalEndpointClient) {
        this.client = client;

        var dataString = JSON.stringify(client.GetData(), null, 4);
        this.dataModel.setData(dataString);

        var linkControllerBuilder = LinkController.Builder(this);
        var iterator: iter.IterableInterface<HalClient.HalLinkInfo> = new iter.Iterable(client.GetAllLinks());
        var linkIter = iterator.select<HalLinkDisplay>(i => this.getLinkDisplay(i));
        this.linkModel.setData(linkIter, linkControllerBuilder.createOnCallback(), this.getLinkVariant);

        var embedsBuilder = HalcyonEmbedsController.Builder();
        this.embedsModel.setData(client.GetAllEmbeds(), embedsBuilder.createOnCallback());
    }

    getCurrentClient() {
        return this.client;
    }

    private getLinkDisplay(i: HalClient.HalLinkInfo) {
        var link: HalLinkDisplay = {
            rel: i.rel,
            href: i.href,
            method: i.method,
            getClient: () => this.client,
        };
        if (i.method === "GET") {
            link.href = '/?entry=' + encodeURIComponent(i.href);
        }
        return link;
    }

    private getLinkVariant(item: HalLinkDisplay) {
        //if (item.method !== "GET") {
            return "form";
        //}
    }
}

class HalcyonSubBrowserController extends HalcyonBrowserController {
    public static SubBrowserBuilder() {
        return new controller.ControllerBuilder<HalcyonSubBrowserController, void, HalClient.HalEndpointClient>(HalcyonSubBrowserController);
    }

    constructor(bindings: controller.BindingCollection, context: void, data: HalClient.HalEndpointClient) {
        super(bindings);
        this.showResults(data);
    }
}

class HalcyonEmbedsController {
    public static Builder() {
        return new controller.ControllerBuilder<HalcyonEmbedsController, void, HalClient.Embed>(HalcyonEmbedsController);
    }

    constructor(bindings: controller.BindingCollection, context: void, data: HalClient.Embed) {
        var itemModel = bindings.getModel<HalClient.HalEndpointClient>("items");
        var subBrowserBuilder = HalcyonSubBrowserController.SubBrowserBuilder();
        itemModel.setData(data.GetAllClients(), subBrowserBuilder.createOnCallback());
    }
}