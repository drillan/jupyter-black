define(function (require, exports, module) {
    'use strict';

    var Jupyter = require('base/js/namespace');
    var keyboard = require('base/js/keyboard');
    var utils = require('base/js/utils');
    var config_module = require('services/config');
    var CodeCell = require('notebook/js/codecell').CodeCell;

    var add_edit_shortcuts = {};
    var replace_in_cell = false; //bool to enable/disable replacements
    var kernel_language; // language associated with kernel

    var cfg = {code_format_hotkey: 'Ctrl-L', aggressive: 1};

    var kernel_map = {
        python: {
            library: 'import black',
            exec: black_format,
            post_exec: ''
        }
    };


    function initialize() {
        var base_url = utils.get_body_data("baseUrl");
        var config = new config_module.ConfigSection('notebook', {base_url: base_url});
        config.load();
        config.loaded.then(function config_loaded_callback() {
            for (var key in cfg) {
                if (config.data.hasOwnProperty(key)) {
                    cfg[key] = config.data[key];
                }
            }
            code_format_hotkey();
        })
    }

    function code_exec_callback(msg) {
        if (msg.msg_type == "error") {
            alert("black extension\n Error: " + msg.content.ename + "\n" + msg.content.evalue);
            return;
        }
        if (replace_in_cell) {
            var ret = msg.content.data['text/plain'];
            for (var i = 1; i < ret.length; i++) {
                if (ret[i - 1] == '\\' && ret[i] == 'n' && (i == 1 || ret[i - 2] != "\\")) {
                    var p = i - 2 >= 0 ? ret.substring(0, i - 1) : "";
                    var s = i + 1 <= ret.length ? ret.substring(i + 1) : "";
                    ret = p + "\n" + s;
                    i = 0;
                }

            }

            ret = ret.substring(1, ret.length - 2)
                .replace(/\\'/g, "'")
                .replace(/\\"/g, '"')
                .replace(/\\\//g, '/')
                .replace(/\\x3c/g, '<')
                .replace(/\\x3e/g, '>')
                .replace(/\\\\/g, '\\');
            var selected_cell = Jupyter.notebook.get_selected_cell();
            selected_cell.set_text(String(ret));
        }
    }


    function exec_code(code_input) {
        console.log(code_input);
        Jupyter.notebook.kernel.execute(code_input, {iopub: {output: code_exec_callback}}, {silent: false});
    }


    function black_format(index) {
        Jupyter.notebook.select(index);
        var selected_cell = Jupyter.notebook.get_selected_cell();
        if (selected_cell instanceof CodeCell) {
            var text = selected_cell.get_text();
            text = JSON.stringify(text)
                .replace(/([^\\])\\\\\\n/g, "$1");
            var code_input = 'black.format_str(' + text + ', 88)';
            exec_code(code_input, index)
        }
    }

    function auto_format() {
        replace_in_cell = true;
        kernel_map[kernel_language].exec()
    }


    function code_format_button() {
        if ($('#code_format_button').length == 0) {
            Jupyter.toolbar.add_buttons_group([{
                'label': 'Black',
                'icon': 'fa-legal',
                'callback': auto_format,
                'id': 'code_format_button'
            }]);
        }
    }

    function code_format_hotkey() {
        add_edit_shortcuts[cfg['code_format_hotkey']] = {
            help: "code formatting",
            help_index: 'black',
            handler: auto_format
        };
    }

    function get_kernel_info() {
        kernel_language = Jupyter.notebook.metadata.kernelspec.language.toLowerCase();
        var knownKernel = kernel_map[kernel_language];
        if (!knownKernel) {
            $('#code_format_button').remove();
            alert("Sorry; black nbextension only works with a Python kernel");
        } else {
            code_format_button();
            Jupyter.keyboard_manager.edit_shortcuts.add_shortcuts(add_edit_shortcuts);
            replace_in_cell = false;
            exec_code(kernel_map[kernel_language].library)
        }
    }


    function load_notebook_extension() {
        initialize();

        if (typeof Jupyter.notebook.kernel !== "undefined" && Jupyter.notebook.kernel != null) {
            get_kernel_info();
        }

        $([Jupyter.events]).on("kernel_ready.Kernel", function () {
            console.log("jupyter-black: restarting");
            get_kernel_info();
        });
    }

    return {
        load_ipython_extension: load_notebook_extension
    };
});
