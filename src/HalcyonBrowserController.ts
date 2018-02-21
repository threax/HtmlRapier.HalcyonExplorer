import * as controller from 'hr.controller';
import * as HalClient from 'hr.halcyon.EndpointClient';
import * as iter from 'hr.iterable';
import * as fetcher from 'hr.fetcher';
import * as uri from 'hr.uri';
import * as WindowFetch from 'hr.windowfetch';
import * as form from 'hr.form';

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

class LinkController {
    public static get InjectorArgs(): controller.DiFunction<any>[] {
        return [controller.BindingCollection, HalcyonBrowserController, controller.InjectControllerData];
    }

    private rel: string;
    private method: string;
    private parentController: HalcyonBrowserController;
    private client: HalClient.HalEndpointClient;
    private formModel: controller.IForm<any> = null;
    private currentError: Error = null;
    private isQueryForm: boolean;
    private hiddenAreaToggle: controller.OnOffToggle;
    private expandButtonToggle: controller.OnOffToggle;

    constructor(bindings: controller.BindingCollection, parentController: HalcyonBrowserController, link: HalLinkDisplay) {
        this.rel = link.rel;
        this.parentController = parentController;
        this.client = link.getClient();
        this.method = link.method;
        this.hiddenAreaToggle = bindings.getToggle("hiddenArea");
        this.hiddenAreaToggle.off();
        this.expandButtonToggle = bindings.getToggle("expandButton");
        this.expandButtonToggle.off();
        this.formModel = bindings.getForm<any>("form");
        this.setup(bindings, parentController);
    }

    private async setup(bindings: controller.BindingCollection, parentController: HalcyonBrowserController): Promise<void>{
        if (this.client.HasLinkDoc(this.rel)) {
            var docResult = await this.client.LoadLinkDoc(this.rel);
            var doc = docResult.GetData<HalEndpointDoc>();
            if (doc.requestSchema) {
                this.formModel.setSchema(doc.requestSchema);
                this.formModel.setData(this.client.GetData());
                this.isQueryForm = false;
            }
            else if (doc.querySchema) {
                this.formModel.setSchema(doc.querySchema);
                this.isQueryForm = true;
            }
        }
    }

    public toggleHiddenArea(evt: Event): void {
        evt.preventDefault();
        evt.stopPropagation();
        evt.stopImmediatePropagation();
        this.hiddenAreaToggle.toggle();
        this.expandButtonToggle.mode = this.hiddenAreaToggle.mode;
    }

    public async submit(evt: Event): Promise<void> {
        evt.preventDefault();
        var promise;
        var data = this.formModel.getData();
        if (data !== null) {
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

        try{
            this.parentController.showResults(await promise);
        }
        catch(err){
            this.currentError = err;
            this.formModel.setError(err);
            alert('Error completing request. Message: ' + err.message);
        }
    }

    private errorPath(path) {
        return path.replace('root.', '');
    }
}

interface Query {
    entry: string;
}

export class HalcyonBrowserController {
    public static get InjectorArgs(): controller.DiFunction<any>[] {
        return [controller.BindingCollection, fetcher.Fetcher, controller.InjectedControllerBuilder, controller.InjectedControllerBuilder];
    }

    private linkModel: controller.Model<HalLinkDisplay>;
    private embedsModel: controller.Model<HalClient.Embed>;
    private dataModel: controller.Model<any>;
    private client: HalClient.HalEndpointClient;

    constructor(bindings: controller.BindingCollection, fetcher: fetcher.Fetcher, private linkControllerBuilder: controller.InjectedControllerBuilder, private embedsBuilder: controller.InjectedControllerBuilder) {
        this.linkModel = bindings.getModel<HalLinkDisplay>("links");
        this.embedsModel = bindings.getModel<HalClient.Embed>("embeds");
        this.dataModel = bindings.getModel<any>("data");
        this.linkControllerBuilder.Services.addSharedInstance(HalcyonBrowserController, this);
        this.setup(fetcher);
    }

    protected async setup(fetcher: fetcher.Fetcher) {
        var query: Query = <Query>uri.getQueryObject();
        if (query.entry !== undefined) {
            var client = await HalClient.HalEndpointClient.Load({ href: query.entry, method: 'GET' }, fetcher);
            this.showResults(client);
        }
        else{
            throw new Error("No entry point");
        }
    }

    showResults(client: HalClient.HalEndpointClient) {
        this.client = client;

        var dataString = JSON.stringify(client.GetData(), null, 4);
        this.dataModel.setData(dataString);
        var iterator: iter.IterableInterface<HalClient.HalLinkInfo> = new iter.Iterable(client.GetAllLinks());
        var linkIter = iterator.select<HalLinkDisplay>(i => this.getLinkDisplay(i));
        this.linkModel.setData(linkIter, this.linkControllerBuilder.createOnCallback(LinkController), this.getLinkVariant);

        this.embedsModel.setData(client.GetAllEmbeds(), this.embedsBuilder.createOnCallback(HalcyonEmbedsController));
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
    private hiddenAreaToggle: controller.OnOffToggle;
    private expandButtonToggle: controller.OnOffToggle;

    public static get InjectorArgs(): controller.DiFunction<any>[] {
        return [controller.BindingCollection, fetcher.Fetcher, controller.InjectControllerData, controller.InjectedControllerBuilder, controller.InjectedControllerBuilder];
    }

    constructor(bindings: controller.BindingCollection, fetcher: fetcher.Fetcher, data: HalClient.HalEndpointClient, linkControllerBuilder: controller.InjectedControllerBuilder, embedsBuilder: controller.InjectedControllerBuilder) {
        super(bindings, fetcher, linkControllerBuilder, embedsBuilder);

        this.hiddenAreaToggle = bindings.getToggle("hiddenArea");
        this.hiddenAreaToggle.off();
        this.expandButtonToggle = bindings.getToggle("expandButton");
        this.expandButtonToggle.off();

        this.showResults(data);
    }

    protected async setup(fetcher: fetcher.Fetcher) {
        //Does nothing
    }

    public toggleHiddenArea(evt: Event): void {
        evt.preventDefault();
        evt.stopPropagation();
        evt.stopImmediatePropagation();
        this.hiddenAreaToggle.toggle();
        this.expandButtonToggle.mode = this.hiddenAreaToggle.mode;
    }
}

class HalcyonEmbedsController {
    public static get InjectorArgs(): controller.DiFunction<any>[] {
        return [controller.BindingCollection, controller.InjectControllerData, controller.InjectedControllerBuilder];
    }

    constructor(bindings: controller.BindingCollection, data: HalClient.Embed, builder: controller.InjectedControllerBuilder) {
        var itemModel = bindings.getModel<HalClient.HalEndpointClient>("items");
        itemModel.setData(data.GetAllClients(), builder.createOnCallback(HalcyonSubBrowserController));
    }
}

export function addServices(services: controller.ServiceCollection){
    services.tryAddTransient(HalcyonBrowserController, HalcyonBrowserController);
    services.tryAddTransient(HalcyonSubBrowserController, HalcyonSubBrowserController);
    services.tryAddTransient(HalcyonEmbedsController, HalcyonEmbedsController);
    services.tryAddTransient(LinkController, LinkController);
    services.tryAddTransient(fetcher.Fetcher, s => new WindowFetch.WindowFetch());
}