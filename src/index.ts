import { promises as fs } from 'fs';
import { join } from 'path';
import { simpleParser, AddressObject } from 'mailparser';
import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import prettyBytes from 'pretty-bytes';
import StreamModule = require('stream');
import Stream = StreamModule.Stream;

type EmlInput = string | Buffer | Stream;
type Template = 'thunderbird';
type Language = 'en' | 'de';

const loadLanguage = async (lang: string) =>
    JSON.parse((await fs.readFile(join(__dirname, '..', 'res', 'i18n', lang + '.json'))).toString());
// The header and footer templates don't respect the page styles. They need their own styles, otherwise they will be
// tiny, see: https://github.com/puppeteer/puppeteer/issues/1822#issuecomment-530533300
const headerFooter = (html: string, align = 'left') =>
    `<div style="font-size: 10px; margin: 10px 20px; width: 100%; text-align: ${align}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${html}</div>`;
const addressesToString = (addr?: AddressObject | AddressObject[]) =>
    addr instanceof Array ? addr.reduce((acc, cur) => acc + ', ' + cur.text, '') : addr?.text;

/**
 * Render emails in .eml format as PDFs.
 *
 * @param eml The email(s) in .eml format to process. You can provide a single email or multiple ones as an array. For
 *            each one, either provide a file path as a string, which will then be read from the filesystem, or the
 *            content of the .eml file as a `Buffer` or `Stream`.
 * @param options.language The language to be used for the labels in the generated PDF (optional, defaults to `en`).
 *                         Currently, English (`en`) and German (`de`) are supported.
 * @param options.template_name The template to use (optional, defaults to `thunderbird`). Currently, only `thunderbird`
 *                              is supported which will generate output similar to Thunderbird’s “Print to PDF” feature.
 *
 * @returns The generated PDF(s) contained in a `Buffer`. A single `Buffer` if you provided a single email for the `eml`
 *          parameter, or an array of `Buffer`s if you provided multiple ones.
 */
export = async function mail2pdf(
    eml: EmlInput | EmlInput[],
    options?: { language?: Language; template_name?: Template }
): Promise<Buffer | Buffer[]> {
    options = { language: 'en', template_name: 'thunderbird', ...options };
    eml = Array.isArray(eml) ? eml : [eml];

    const i18n = await loadLanguage(options.language!);
    const i18n_fallback = await loadLanguage('en');
    const template = handlebars.compile(
        (await fs.readFile(join(__dirname, '..', 'res', 'templates', options?.template_name + '.hbr'))).toString()
    );

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const result = await Promise.all(
        eml.map(async (e) => {
            const mail = await simpleParser(typeof e === 'string' ? await fs.readFile(e) : e);

            const html = template({
                subject: mail.subject,
                has_html_body: mail.html !== false,
                body: mail.html || mail.textAsHtml,
                from: mail.from?.text,
                date: mail.date?.toISOString(),
                to: addressesToString(mail.to),
                cc: addressesToString(mail.cc),
                bcc: addressesToString(mail.bcc),
                priority: mail.priority,
                attachments: mail.attachments
                    .filter((a) => a.contentDisposition === 'attachment')
                    .map((a) => ({ ...a, filename: a.filename || '<unnamed>', prettySize: prettyBytes(a.size) })),
                i18n: { ...i18n_fallback, ...i18n },
            });
            await page.setContent(html);

            const pdf = await page.pdf({
                format: 'a4',
                margin: { top: '20mm', bottom: '20mm', right: '20mm', left: '20mm' },
                displayHeaderFooter: true,
                headerTemplate: headerFooter('<span class="title"></span>'),
                footerTemplate: headerFooter(
                    '<span class="pageNumber"></span>/<span class="totalPages"></span>',
                    'right'
                ),
                printBackground: true,
            });
            return pdf;
        })
    );

    await browser.close();

    return result.length === 1 ? result[0] : result;
};
