import { promises as fs } from 'fs';
import { join } from 'path';
import { simpleParser, AddressObject } from 'mailparser';
import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import prettyBytes from 'pretty-bytes';
import StreamModule = require('stream');
import Stream = StreamModule.Stream;

type Template = 'thunderbird';
type Language = 'en';

// The header and footer templates don't respect the page styles. They need their own styles, otherwise they will be
// tiny, see: https://github.com/puppeteer/puppeteer/issues/1822#issuecomment-530533300
const headerFooter = (html: string, align = 'left') =>
    `<div style="font-size: 10px; margin: 10px 20px; width: 100%; text-align: ${align}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${html}</div>`;
const addressesToString = (addr?: AddressObject | AddressObject[]) =>
    addr instanceof Array ? addr.reduce((acc, cur) => acc + ', ' + cur.text, '') : addr?.text;

/**
 * Generate a PDF from the provided .eml file.
 *
 * @param eml The email in .eml format to process. Either provide a file path as a string, which will then be read from
 *            the filesystem, or the content of the .eml file as a `Buffer` or `Stream`.
 * @param options.out_path The file path where the generated PDF should be stored (optional).
 * @param options.language The language to be used for the labels in the generated PDF (optional, defaults to `en`).
 *                         Currently, only English is supported.
 * @param options.template_name The template to use (optional, defaults to `thunderbird`). Currently, only `thunderbird`
 *                              is supported which will generate output similar to Thunderbird’s “Print to PDF” feature.
 *
 * @returns A `Buffer` containing the generated PDF.
 */
export default async function mail2pdf(
    eml: string | Buffer | Stream,
    options?: { out_path?: string; language?: Language; template_name?: Template }
): Promise<Buffer> {
    options = { language: 'en', template_name: 'thunderbird', ...options };

    const mail = await simpleParser(typeof eml === 'string' ? await fs.readFile(eml) : eml);

    const template = handlebars.compile(
        (await fs.readFile(join(__dirname, '..', 'templates', options.template_name + '.hbr'))).toString()
    );
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
    });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({
        format: 'a4',
        margin: { top: '20mm', bottom: '20mm', right: '20mm', left: '20mm' },
        displayHeaderFooter: true,
        headerTemplate: headerFooter('<span class="title"></span>'),
        footerTemplate: headerFooter('<span class="pageNumber"></span>/<span class="totalPages"></span>', 'right'),
        printBackground: true,
        ...(options.out_path ? { path: options.out_path } : {}),
    });
    await browser.close();

    return pdf;
}
