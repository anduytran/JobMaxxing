import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Reads selectable text from a PDF in the browser — a backup if the agent can't take the file. */
export async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjs = (await import("pdfjs-dist")) as unknown as {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument(src: { data: ArrayBuffer }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str: string }[] }> }> }> };
    };
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, 12); n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(content.items.map((i) => i.str).join(" "));
    }
    return pages.join("\n").replace(/[ \t]+/g, " ").trim();
  } catch {
    return "";
  }
}

