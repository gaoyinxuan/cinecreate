/**
 * Sample project import/restore logic.
 * Reads from src/sample-data/sample-project.json (bundled at build time).
 */

import { db } from './dbService';
import sampleData from '../sample-data/sample-project.json';

const SAMPLE_KEY = 'sample_imported_v1';

export async function importSampleProjectIfNeeded(): Promise<boolean> {
  // Check if already imported
  const imported = await db.meta.get(SAMPLE_KEY);
  if (imported) return false;

  try {
    const data = await fetchSampleData();
    if (!data?.project) return false;
    await createSampleProject(data);
    await db.meta.set(SAMPLE_KEY, true);
    return true;
  } catch (e) {
    console.error('Failed to import sample project:', e);
    return false;
  }
}

export async function restoreSampleProject(): Promise<string | null> {
  try {
    const data = await fetchSampleData();
    if (!data?.project) return null;

    // Find a unique name
    const allProjects = await db.projects.getAll();
    let name = data.project.name || '案例（默认）';
    let suffix = 1;
    while (allProjects.some((p: any) => p.name === name)) {
      suffix++;
      name = `${data.project.name} (${suffix})`;
    }

    await createSampleProject(data, name);
    return name;
  } catch (e) {
    console.error('Failed to restore sample project:', e);
    return null;
  }
}

function fetchSampleData(): any {
  return sampleData;
}

async function createSampleProject(data: any, overrideName?: string) {
  const now = new Date().toISOString();
  const projectName = overrideName || data.project.name || '案例（默认）';

  // Create project
  const project = await db.projects.create(projectName);
  if (!project?.id) throw new Error('Failed to create project');
  const pid = project.id;

  // Import blobs first
  if (data.blobs) {
    for (const [blobId, base64] of Object.entries(data.blobs)) {
      try {
        const buffer = Uint8Array.from(atob(base64 as string), c => c.charCodeAt(0)).buffer;
        await (db.blobs as any).save(blobId, new Blob([buffer]));
      } catch {}
    }
  }

  // Import sequences
  const seqIdMap: Record<string, string> = {};
  if (data.sequences) {
    for (const seq of data.sequences) {
      const newSeq = await db.sequences.create({
        projectId: pid, name: seq.name, description: seq.description || '',
        startTime: seq.startTime || '', endTime: seq.endTime || '',
        orderIndex: seq.orderIndex || 0
      });
      if (newSeq?.id) seqIdMap[seq.id] = newSeq.id;
    }
  }

  // Import shots
  if (data.shots) {
    for (const shot of data.shots) {
      await db.shots.create({
        projectId: pid,
        sequenceId: seqIdMap[shot.sequenceId] || '',
        title: shot.title || '', description: shot.description || '',
        variants: typeof shot.variants === 'string' ? JSON.parse(shot.variants || '[]') : (shot.variants || []),
        startTime: shot.startTime || '', endTime: shot.endTime || '',
        duration: shot.duration || '',
        tags: typeof shot.tags === 'string' ? JSON.parse(shot.tags || '[]') : (shot.tags || []),
        metadata: typeof shot.metadata === 'string' ? JSON.parse(shot.metadata || '{}') : (shot.metadata || {}),
        orderIndex: shot.orderIndex || 0
      });
    }
  }

  // Import drafts
  if (data.drafts) {
    for (const draft of data.drafts) {
      await db.dts.create({
        projectId: pid,
        name: draft.name || '草稿V1',
        currentStep: draft.currentStep || 1,
        confirmedAssets: typeof draft.confirmedAssets === 'string' ? draft.confirmedAssets : JSON.stringify(draft.confirmedAssets || {}),
        conversation: typeof draft.conversation === 'string' ? draft.conversation : JSON.stringify(draft.conversation || [])
      });
    }
  }

  // Import stories
  if (data.stories) {
    for (const story of data.stories) {
      await (db as any).ai.stories.create({
        projectId: pid,
        title: story.title || '',
        logline: story.logline || '',
        fullContent: typeof story.fullContent === 'string' ? story.fullContent : JSON.stringify(story.fullContent || {}),
        status: story.status || 'draft'
      });
    }
  }

  // Import characters
  if (data.characters) {
    for (const char of data.characters) {
      await (db as any).ai.characters.create({
        projectId: pid,
        storyId: char.storyId || '',
        name: char.name || '', age: char.age || '',
        appearance: char.appearance || '', costume: char.costume || '',
        personality: char.personality || '', background: char.background || '',
        portraitPrompt: char.portraitPrompt || '', role: char.role || '配角'
      });
    }
  }

  // Import station
  if (data.station && data.station.length > 0) {
    await db.meta.set(`station_${pid}`, data.station);
  }

  // Import documents
  if (data.documents) {
    for (const doc of data.documents) {
      await db.docs.create({
        projectId: pid, parentId: doc.parentId || null,
        type: doc.type || 'document', title: doc.title || '',
        content: doc.content || '',
        metadata: typeof doc.metadata === 'string' ? JSON.parse(doc.metadata || '{}') : (doc.metadata || {}),
        sortOrder: doc.sortOrder || 0
      });
    }
  }

  return pid;
}
