import matter from 'gray-matter';
import { fileURLToPath } from 'node:url'

import Asciidoctor from 'asciidoctor'
const adoc = Asciidoctor()
import { rehype } from 'rehype'
import rehypeHighlight from 'rehype-highlight'
import clojureLang from 'highlight.js/lib/languages/clojure'

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
            const doc = adoc.load(body, {attributes: {showtitle: true}})
            const { value: html } =
                  await rehype().data('settings', {fragment: true})
                                .use(rehypeHighlight, {languages: {clojure: clojureLang}})
                                .process(doc.convert())

            let headings = []
            function getHeadings(section) {
              return {
                html: section.getTitle(),
                slug: section.getId(),
                children: section.getSections().map(getHeadings),
              };
            }
            headings = doc.getSections().map(getHeadings)

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

