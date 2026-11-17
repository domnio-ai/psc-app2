export type PreparedReportImage = {
  src: string;
  alt: string;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("The selected image could not be decoded."));
    image.onload = () => resolve(image);
    image.src = src;
  });

const fileNameToAlt = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function prepareReportImage(
  file: File,
  maxDimension = 1200,
): Promise<PreparedReportImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a PNG, JPEG, WebP or GIF image.");
  }

  const source = await readFileAsDataUrl(file);
  const alt = fileNameToAlt(file.name);

  if (file.type === "image/gif") {
    return { src: source, alt };
  }

  const image = await loadImage(source);
  const largestSide = Math.max(image.width, image.height);
  const scale = Math.min(1, maxDimension / Math.max(1, largestSide));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) return { src: source, alt };

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const prepared =
    outputType === "image/png"
      ? canvas.toDataURL(outputType)
      : canvas.toDataURL(outputType, 0.78);

  return { src: prepared || source, alt };
}

export function markSelectedReportImage(
  previous: HTMLImageElement | null,
  next: HTMLImageElement | null,
) {
  previous?.classList.remove("app2-report-image-selected");
  next?.classList.add("app2-report-image-selected");
}
