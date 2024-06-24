import matter from 'gray-matter';
import { fileURLToPath } from 'node:url'

import Asciidoctor from 'asciidoctor'
const adoc = Asciidoctor()
import { rehype } from 'rehype'
import rehypeHighlight from 'rehype-highlight'
import clojureLang from 'highlight.js/lib/languages/clojure'
import rr from '../../lib/railroad/railroad.js'

function getEntryInfo({ fileUrl, contents }) {
  const parsed = matter(contents);
  return {
    data: {path: fileURLToPath(fileUrl), ...parsed.data},
    body: parsed.content,
    slug: parsed.data.slug,
    rawData: parsed.matter,
  };
}

adoc.Extensions.register(function () {
  this.block (function () {
    const self = this
    self.named('railroad')
    self.onContext('listing')
    self.process(function (parent, reader) {
      const diag = eval(`(rr) => {${reader.getString()}}`)(rr)
      return self.createBlock(parent, 'pass', diag.toString())
    })
  })
})

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

