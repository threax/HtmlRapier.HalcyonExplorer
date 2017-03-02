import * as HalEndpointClient from 'hr.halcyon.EndpointClient';
import * as WindowFetch from 'hr.windowfetch';
import * as CacheBuster from 'hr.cachebuster';
import * as uri from 'hr.uri';

interface Query {
    entry: string;
}

export class PageStart {
    private fetcher: WindowFetch.WindowFetch;
    private entryPoint: HalEndpointClient.HalEndpointClient;

    constructor() {
        this.fetcher = new WindowFetch.WindowFetch();
    }

    /**
     * The entry point to the api.
     * @returns
     */
    get EntryPoint() {
        return this.entryPoint;
    }

    __loadResources(): Promise<PageStart> {
        var query: Query = <Query>uri.getQueryObject();
        if (query.entry !== undefined) {
            return HalEndpointClient.HalEndpointClient.Load({ href: query.entry, method: 'GET' }, this.fetcher)
                .then(client => this.entryPoint = client)
                .then(data => this);
        }

        return Promise.reject("No entry point");
    }
}

var instance: PageStart = null;
/**
 * Set up common config for the page to run.
 * @returns A Promise with the PageStart instance inside.
 */
export function init(): Promise<PageStart> {
    if (instance === null) {
        instance = new PageStart();
        return instance.__loadResources();
    }

    return Promise.resolve(instance);
}