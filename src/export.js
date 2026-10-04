import { getAdapter, getSourceAction } from './adapters.js';
import { withExportMetadata } from './metadata.js';
import { localizeImages } from './image-export.js';
import { appendDebugInfo } from './debug.js';

export function assertExportResult(result) {
  for (const key of ['markdown', 'title', 'sourceUrl', 'filename']) {
    if (!result?.[key]) throw new Error(`Source adapter returned no ${key}`);
  }
  return result;
}

export async function runExport({ source, actionId, tab, includeIntegrity = false, includeDebug = false }, dependencies) {
  const adapter = getAdapter(source?.id);
  const action = getSourceAction(source, actionId);
  if (!adapter || !action || action.enabled === false) {
    throw new Error('This export action is not available for the active tab');
  }

  const capturedAt = new Date();
  const captured = assertExportResult(await adapter.capture({
    tab,
    detection: source.detection,
    action
  }, dependencies));
  const localized = action.images ? await localizeImages(captured, url => dependencies.fetchImage(tab.id, url)) : captured;
  const annotated = includeDebug ? {
    ...localized,
    markdown: appendDebugInfo(localized.markdown, {
      source: source.id,
      action: action.id,
      sourceUrl: captured.sourceUrl,
      capturedAt: capturedAt.toISOString(),
      ...(action.images ? {
        detectedImageUrls: captured.imageAssets?.map(image => image.url) || [],
        savedImagePaths: localized.assets?.map(asset => asset.path) || [],
        imageFailures: localized.imageFailures || []
      } : {})
    })
  } : localized;
  const result = await withExportMetadata(annotated, { includeIntegrity, capturedAt });

  if (action.output === 'copy') {
    await dependencies.copy(result.markdown);
  } else if (action.output === 'download') {
    if (action.images) await dependencies.downloadImages(result);
    else await dependencies.download(result);
  } else {
    throw new Error(`Unsupported export output: ${action.output}`);
  }

  return { ...result, output: action.output };
}
