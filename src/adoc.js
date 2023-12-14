import matter from 'gray-matter';
import { fileURLToPath } from 'node:url'

import Asciidoctor from 'asciidoctor'
const adoc = Asciidoctor()
import { rehype } from 'rehype'
import rehypeHighlight from 'rehype-highlight'
import clojureLang from 'highlight.js/lib/languages/clojure'

function shouldStrip(block) {
  return block.getAttribute('string') === 'unescape'
}

// If a source block has the attribute `string` set to `unescape` then:
// - Surrounding double quotes are removed
// - Double quotes are unescaped
// Useful for including a string from a clojure test file.
//
// E.g:
// [source,json,string=unescape]
// ----
// "{
//    \"foo|": \"bar\"
//  }"
// ----
//
// =>
//
// [source,json,string=unescape]
// ----
// {
//   "foo": "bar"
// }
// ----
function stringUnescapeProcessor (registry) {
  registry.treeProcessor(function () {
    var self = this
    self.process(function (doc) {
      var blocks = doc.findBy({ 'context': 'listing', 'style': 'source' }, shouldStrip)

      for (var i = 0; i < blocks.length; i++) {
        var source = blocks[i].getSource()

        source = source.trim()

        // Remove the extra space on all lines except the first
        // "{
        //     foo: \"bar\"
        //  }"
        if (source.match(/^"[^\s]/g)) {
          source = source.replace(/\n /g, '\n')
        }
        // Remove all unescaped double quotes (e.g. surrounding ones)
        source = source.replaceAll(/(^|[^\\])"/g, '$1')
        // Unescape double quotes
        source = source.replaceAll(/\\"/g, '"')

        blocks[i].lines = source.split('\n')
      }

      return doc
    })
  })
}

const registry = adoc.Extensions.create()
stringUnescapeProcessor(registry)

function getEntryInfo({ fileUrl, contents }) {
  const parsed = matter(contents);
  return {
    data: {path: fileURLToPath(fileUrl), ...parsed.data},
    body: parsed.content,
    slug: parsed.data.slug,
    rawData: parsed.matter,
  };
}

export default function adocIntegration() {
  return {
    name: "@xtdb/adoc",
    hooks: {
      'astro:config:setup': async(params) => {
        const { config: astroConfig, addContentEntryType } = params

        addContentEntryType({
          extensions: ['.adoc'],

          getEntryInfo,

          async getRenderModule({ contents, fileUrl }) {
            const { body } = getEntryInfo({ contents, fileUrl });
            const doc = adoc.load(body, {
              // Required to allow `include` directives for files outside of the root directory
              safe: 'unsafe',
              extension_registry: registry,
              attributes: {
                showtitle: true,
              }})

            const { value: html } =
                  await rehype().data('settings', {fragment: true})
                                .use(rehypeHighlight, {languages: {clojure: clojureLang}})
                                .process(doc.convert())

            let headings = []
            function pushHeadings(section) {
              headings.push({depth: section.getLevel() + 1, text: section.getTitle(), slug: section.getId()})
              section.getSections().forEach(pushHeadings)
            }
            doc.getSections().forEach(pushHeadings)

            return {
              code: `
import { jsx as h, Fragment } from 'astro/jsx-runtime';
import path from 'path'
import 'highlight.js/styles/github-dark-dimmed.css';

export function getHeadings() {
  return ${JSON.stringify(headings)}
}

export async function Content (props) {
  return h(Fragment, {'set:html': ${JSON.stringify(html)}});
}
`
            }
          }
        })
      },

      'astro:server:setup': async ({server}) => {
        server.watcher.on('all', (event, entry) => {
          if (entry.endsWith('/adoc.js')) {
            server.restart();
          }
        });
      }
    }
  }
}

