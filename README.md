# mail2pdf

> Node.js library to render emails stored as .eml files to PDF.

![An example email converted using mail2pdf. On the left, the .eml file is opened in Thunderbird, on the right, the result PDF is opened. The test email was created using Microsoft Outlook and contains complex formatting like tables and images. The conversion was successful.](https://cdn.baltpeter.io/img/mail2pdf-screenshot.png)

With mail2pdf, you can convert emails stored as .eml files (as exported by Thunderbird, for example) to PDF files from Node.js. The goal is to produce an output that closely matches what an actual email program would export when using the "Print to PDF" feature. This can be useful for archival purposes, for example.

To produce the best possible output, mail2pdf deliberately relies on the rather heavy Puppeteer library which spawns an entire headless Chromium instance, instead of choosing another HTML to PDF solution implemented natively in JS.

The actual implementation is rather simple, it is mostly a thin wrapper around [Puppeteer](https://github.com/puppeteer/puppeteer/) and Nodemailer's [Mailparser](https://nodemailer.com/extras/mailparser/). The library supports internationalization and using different output templates. Currently, one template is provided that imitates Thunderbird's PDF output.

## Installation

You can install mail2pdf using yarn or npm:

```sh
yarn add mail2pdf
# or `npm i mail2pdf`
```

## Example usage

To demonstrate how to use mail2pdf, this code shows how to convert a [sample .eml file](https://cdn.baltpeter.io/other/mail2pdf/sample.eml) to PDF. The email was sent using Microsoft Outlook and contains complex formatting like tables and images.

```js
import mail2pdf from 'mail2pdf';
import { promises as fs } from 'fs';

(async () => {
  // Simply call the `mail2pdf()` function with the email (or
  // emails as an array) you want to convert. You can also
  // pass additional options, see below for details.
  const pdf = await mail2pdf('sample.eml', { language: 'en' });
  // The resulting PDF is returned as a `Buffer` that you can
  // save to disk for example.
  await fs.writeFile('sample.pdf', pdf);
})();
```

You can view the conversion result [here](https://cdn.baltpeter.io/other/mail2pdf/sample.pdf).

## API

Only a single function is provided with the following interface:

### `mail2pdf(eml, options?)`

**Parameters:**

- `eml` - The email(s) in .eml format to process. You can provide a single email or multiple ones as an array. For
  each one, either provide a file path as a string, which will then be read from the filesystem, or the
  content of the .eml file as a `Buffer` or `Stream`.
- `options` - An optional object with the following properties:
    - `language` - The language to be used for the labels in the generated PDF (optional, defaults to `en`).
    Currently, English (`en`) and German (`de`) are supported.
    - `template_name` - The template to use (optional, defaults to `thunderbird`). Currently, only `thunderbird`
    is supported which will generate output similar to Thunderbird’s “Print to PDF” feature.

**returns:** `Promise<Buffer | Buffer[]>` - The generated PDF(s) contained in a `Buffer`. A single `Buffer` if you provided a single email for the `eml` parameter, or an array of `Buffer`s if you provided multiple ones. 

## License

mail2pdf is licensed under the MIT license, see the [`LICENSE`](/LICENSE) file for details.

Issues and pull requests are welcome! If you find an email that doesn't render correctly, please let me know. To help reproduce the problem, it would be great if you could attach the .eml file in question to the issue.
