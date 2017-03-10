## TODO

* `--config <file>` /  --config-module <module>

  Loads `<file>` relative to the working directory, or uses `require` to load
  `<module>`.

  Modules can specify configuration like:

  ```
    const md = new markdownIt('commonmark')
    md.use(require('markdown-it-katex'),
        {"throwOnError" : false, "errorColor" : " #cc0000"})
    md.use(mdDeflist)
    md.enable('table')
    md.enable('strikethrough')

    module.exports = {
        markdown: md,
        interface: '127.0.0.1',
        allow_unsafe_content: false,
        block_external: false,
    }
  ```

  This will be loaded by the server and used to process markdown before pushing
  it to the server.

* Allow selecting style sheets via a command line option of in the module
  configuration.

* Process YAML

  If a file has YAML frontmatter, extract it,

  -  set the documents title to the value of `title`.
  -  set the class of the content divs to the value of `style`.

     This allows multiple different styles within the same stylesheet. e.g.
     the `math-assignment` makes LaTeX look good, where as `double-space`
     changes `line-spacing` to `1em` for writing Essays.

* Auto-scroll to first detected change in the DOM tree of the old and new
  documents
