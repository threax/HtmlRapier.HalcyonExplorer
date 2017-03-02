"use strict";

import { JSONEditor, JSONEditorOptions } from 'jdorn.json-editor';
import * as models from 'hr.models'

JSONEditor.defaults.theme = 'bootstrap3custom';
JSONEditor.defaults.iconlib = 'bootstrap3';
JSONEditor.defaults.disable_collapse = true;
JSONEditor.defaults.disable_edit_json = true;
JSONEditor.defaults.disable_properties = true;

//Override Boolean editors, we want checkboxes by default for booleans
JSONEditor.defaults.resolvers.unshift(function (schema) {
    if (schema.type === 'boolean') {
        // If explicitly set to 'select', use that
        if (schema.format === "select" || (schema.options && schema.options.select)) {
            return "select";
        }
        // Otherwise, default to select menu
        return 'checkbox';
    }
});

/**
 * A custom model for json editor instances. Gives access to the wrapped editor.
 */
export interface JsonEditorModel<T> extends models.Model<T>{
    /**
     * The editor that this model wraps.
     */
    getEditor();
}

/**
 * This class actually implements the interface that talks to the JSON Editor.
 */
class ConcreteJsonEditorModel<T> implements JsonEditorModel<T> {
    private editor;

    constructor(editor){
        this.editor = editor;
    }

    setData(data:T) {
        this.editor.root.setValue(data, true);
    }

    appendData = this.setData;

    clear() {
        this.editor.root.setValue(null, true);
    }

    getData():T {
        return this.editor.getValue();
    }

    getEditor() {
        return this.editor;
    }

    getSrc(): string {
        return null;
    }
}

/**
 * This is a typed model for the json editor. It will use the strongConstructor passed in
 * to convert to a strong type.
 */
class JsonEditorTypedModel<T> extends models.StrongTypedModel<T> implements JsonEditorModel<T>
{
    constructor(childModel: JsonEditorModel<T>, strongConstructor: models.StrongTypeConstructor<T>) {
        super(childModel, strongConstructor);
    }

    getEditor() {
        return this.childModel.getEditor();
    }
}

/**
 * The options for the Json Editor Model. Also provides the options for the Json Editor the model will wrap.
 */
export interface JsonEditorModelOptions<T> extends JSONEditorOptions{
    strongConstructor?: models.StrongTypeConstructor<T>;
}

/**
 * Helper function to create the right model depending on your settings.
 */
export function create<T>(element: HTMLElement, options?:JsonEditorModelOptions<T>): JsonEditorModel<T> {
    var model:JsonEditorModel<T> = new ConcreteJsonEditorModel<T>(new JSONEditor(element, options))
    if(options !== undefined && options.strongConstructor !== undefined){
        model = new JsonEditorTypedModel<T>(model, options.strongConstructor);
    }
    return model;
}