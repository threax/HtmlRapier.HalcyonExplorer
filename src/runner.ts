import * as PageStart from 'hr.halcyon-explorer.HalApiBrowserStart';
import { HalcyonBrowserController } from 'hr.halcyon-explorer.HalcyonBrowserController';

PageStart.init()
    .then(config => {
        var browsers = HalcyonBrowserController.Builder().create("halcyonbrowser");
        browsers[0].showResults(config.EntryPoint);
    });