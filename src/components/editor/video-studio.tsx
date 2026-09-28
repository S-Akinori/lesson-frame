"use client";

import {Player} from "@remotion/player";
import Image from "next/image";
import {
  ArrowDown, ArrowUp, CheckCircle, DownloadSimple, FileImage, FilmSlate,
  GearSix, LinkSimple, MagicWand, MusicNotes, Play, Plus, SpeakerHigh,
  SpinnerGap, Trash, UploadSimple, WarningCircle, Waveform,
} from "@phosphor-icons/react";
import {useEffect, useRef, useState} from "react";
import type {ChangeEvent} from "react";
import {LessonComposition} from "@/components/video/lesson-composition";
import {
  parseProjectFile,
  projectFileErrorMessage,
  projectFileName,
  serializeProjectFile,
} from "@/lib/project-file";
import {projectSchema} from "@/lib/project-schema";
import {estimateDuration, formatDuration, parseScript, toSpeechText, totalDuration} from "@/lib/script";
import type {LessonChunk, LessonProject, ProjectTemplate, ReusableAsset} from "@/lib/types";
import {GEMINI_VOICES, VOICE_STYLE_EXAMPLES} from "@/lib/voices";

const sampleScript = `今日は気体の状態方程式について説明します。
ボイルの法則とシャルルの法則を、別々に覚える必要はありません。
状態方程式は $PV=nRT$ と表されます。
圧力、体積、物質量、温度の関係を一つの式で確認できます。`;

const initialProject = (title = ""): LessonProject => ({
  id: crypto.randomUUID(),
  title,
  fps: 30,
  width: 1920,
  height: 1080,
  gapInSeconds: 0.15,
  voice: "Kore",
  voiceStyle: "テンポよく、落ち着いたトーンで親しみやすい口調で解説する。",
  theme: {background: "blueprint", accent: "#c45d45", showMainText: true},
  chunks: [],
});

type Notice = {kind: "error" | "success" | "info"; message: string} | null;
type UploadTicket = {
  ok?: boolean;
  error?: string;
  key: string;
  readUrl: string;
  uploadUrl?: string;
  duplicate?: boolean;
  asset?: Omit<ReusableAsset, "url">;
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const fileSha256 = async (file: File) => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const imageValidationError = (file: File) => {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return "PNG、JPEG、WebP画像を選択してください。";
  }
  if (file.size > 20 * 1024 * 1024) {
    return "画像は20MB以下にしてください。";
  }
  return null;
};

const backgroundMusicValidationError = (file: File) => {
  if (!["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/vnd.wav", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "application/ogg"].includes(file.type)) {
    return "MP3、WAV、M4A、AAC、OGG音声を選択してください。";
  }
  if (file.size > 50 * 1024 * 1024) {
    return "BGMは50MB以下にしてください。";
  }
  return null;
};

export function VideoStudio() {
  const [project, setProject] = useState<LessonProject>(() => initialProject());
  const [script, setScript] = useState("");
  const [selectedId, setSelectedId] = useState(project.chunks[0]?.id ?? "");
  const [notice, setNotice] = useState<Notice>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderUrl, setRenderUrl] = useState<string>();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [projects, setProjects] = useState<LessonProject[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [assetLibrary, setAssetLibrary] = useState<ReusableAsset[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"script" | "image">("script");
  const [generateOnSetup, setGenerateOnSetup] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [saveState, setSaveState] = useState<"読み込み中" | "保存中" | "保存済み" | "ローカル保存">("読み込み中");
  const playerRef = useRef<React.ElementRef<typeof Player>>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const renderUrlRef = useRef<string | undefined>(undefined);

  const replaceRenderUrl = (nextUrl?: string) => {
    if (renderUrlRef.current) URL.revokeObjectURL(renderUrlRef.current);
    renderUrlRef.current = nextUrl;
    setRenderUrl(nextUrl);
  };

  const selected = project.chunks.find((chunk) => chunk.id === selectedId) ?? project.chunks[0];
  const duration = totalDuration(project.chunks, project.gapInSeconds);
  const durationInFrames = Math.max(1, Math.ceil(duration * project.fps));
  const selectedVoiceId = selected?.voice ?? project.voice;
  const selectedVoiceStyle = selected?.voiceStyle ?? project.voiceStyle;
  const selectedVoice = GEMINI_VOICES.find((voice) => voice.id === selectedVoiceId);
  const selectedAssets = selected ? [...(selected.asset ? [selected.asset] : []), ...(selected.assets ?? [])] : [];
  const imageLibrary = assetLibrary.filter((asset) => asset.kind === "image");
  const audioLibrary = assetLibrary.filter((asset) => asset.kind === "audio");
  const readyCount = project.chunks.filter((chunk) => chunk.audio).length;
  const missingAudioCount = project.chunks.length - readyCount;
  const incompleteTextCount = project.chunks.filter((chunk) => !chunk.displayText.trim() || !chunk.speechText.trim()).length;

  useEffect(() => {
    let cancelled = false;
    const loadProjects = async () => {
      const localProjects: LessonProject[] = [];
      try {
        const storedProjects = localStorage.getItem("lesson-frame-projects");
        if (storedProjects) {
          const values = JSON.parse(storedProjects) as LessonProject[];
          localProjects.push(...values.filter((value) => value.title?.trim()));
        }
        const stored = localStorage.getItem("lesson-frame-project");
        if (stored) {
          const value = JSON.parse(stored) as LessonProject;
          if (value.title?.trim() && !localProjects.some((item) => item.id === value.id)) localProjects.unshift(value);
        }
      } catch {
        localStorage.removeItem("lesson-frame-project");
      }

      try {
        const [response, assetResponse, templateResponse] = await Promise.all([
          fetch("/api/projects", {cache: "no-store"}),
          fetch("/api/assets", {cache: "no-store"}),
          fetch("/api/templates", {cache: "no-store"}),
        ]);
        const result = await response.json() as {ok?: boolean; projects?: LessonProject[]; error?: string};
        if (!response.ok || !result.ok) throw new Error(result.error ?? "プロジェクトDBへ接続できませんでした。");
        const assetResult = await assetResponse.json() as {ok?: boolean; assets?: ReusableAsset[]};
        const templateResult = await templateResponse.json() as {ok?: boolean; templates?: ProjectTemplate[]};
        const remoteProjects = result.projects ?? [];
        const migrationTargets = localProjects.filter((local) => !remoteProjects.some((remote) => remote.id === local.id));
        for (const local of migrationTargets) {
          const migration = await fetch("/api/projects", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(local),
          });
          if (!migration.ok) throw new Error("既存プロジェクトをDBへ移行できませんでした。");
        }
        if (!cancelled) {
          setProjects([...migrationTargets, ...remoteProjects]);
          setAssetLibrary(assetResult.ok ? assetResult.assets ?? [] : []);
          setTemplates(templateResult.ok ? templateResult.templates ?? [] : []);
          setSaveState("保存済み");
        }
        localStorage.removeItem("lesson-frame-project");
        localStorage.removeItem("lesson-frame-projects");
      } catch {
        if (!cancelled) {
          setProjects(localProjects);
          setSaveState("ローカル保存");
          setNotice({kind: "info", message: "Cloudflare D1へ接続できないため、このブラウザ内に保存します。"});
        }
      } finally {
        if (!cancelled) setHasLoaded(true);
      }
    };
    void loadProjects();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (renderUrlRef.current) URL.revokeObjectURL(renderUrlRef.current);
  }, []);

  useEffect(() => {
    if (!hasLoaded || !project.title.trim()) return;
    const timer = window.setTimeout(async () => {
      setSaveState("保存中");
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(project),
        });
        const result = await response.json() as {ok?: boolean; error?: string; warning?: string};
        if (!response.ok || !result.ok) throw new Error(result.error ?? "プロジェクトを保存できませんでした。");
        setProjects((current) => {
          const nextProjects = [project, ...current.filter((item) => item.id !== project.id)];
          return nextProjects;
        });
        localStorage.removeItem("lesson-frame-project");
        localStorage.removeItem("lesson-frame-projects");
        setSaveState("保存済み");
        if (result.warning) setNotice({kind: "info", message: result.warning});
      } catch {
        localStorage.setItem("lesson-frame-project", JSON.stringify(project));
        setProjects((current) => {
          const nextProjects = [project, ...current.filter((item) => item.id !== project.id)];
          localStorage.setItem("lesson-frame-projects", JSON.stringify(nextProjects));
          return nextProjects;
        });
        setSaveState("ローカル保存");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project, hasLoaded]);

  const updateChunk = (id: string, patch: Partial<LessonChunk>) => {
    setProject((current) => ({...current, chunks: current.chunks.map((chunk) => chunk.id === id ? {...chunk, ...patch} : chunk)}));
  };

  const updateVoiceSettings = (patch: Partial<Pick<LessonProject, "voice" | "voiceStyle">>) => {
    setProject((current) => ({
      ...current,
      ...patch,
      chunks: current.chunks.map((chunk) => ({...chunk, status: "draft", audio: undefined})),
    }));
  };

  const selectChunk = (id: string) => {
    const index = project.chunks.findIndex((chunk) => chunk.id === id);
    const startInSeconds = project.chunks
      .slice(0, Math.max(0, index))
      .reduce((sum, chunk) => sum + chunk.durationInSeconds + project.gapInSeconds, 0);
    setSelectedId(id);
    playerRef.current?.seekTo(Math.floor(startInSeconds * project.fps));
  };

  const startNewProject = () => {
    const title = newProjectName.trim();
    if (!title) {
      setNotice({kind: "error", message: "プロジェクト名を入力してください。"});
      return;
    }
    const template = templates.find((item) => item.id === selectedTemplateId);
    const nextProject = initialProject(title);
    if (template) {
      nextProject.voice = template.voice;
      nextProject.voiceStyle = template.voiceStyle;
      nextProject.backgroundMusic = template.backgroundMusic;
      nextProject.chunks = template.chunks.map((chunk, order) => ({
        ...chunk,
        id: crypto.randomUUID(),
        order,
        status: "draft",
        audio: undefined,
        asset: undefined,
        assets: undefined,
      }));
    }
    setProject(nextProject);
    setScript(nextProject.chunks.map((chunk) => chunk.displayText).join("\n"));
    setSelectedId(nextProject.chunks[0]?.id ?? "");
    setRenderUrl(undefined);
    setNotice(null);
    setNewProjectName("");
    setSelectedTemplateId("");
    setIsCreatingProject(false);
    setActiveStep(2);
  };

  const registerReusableAsset = async (asset: Omit<ReusableAsset, "id" | "createdAt">) => {
    const response = await fetch("/api/assets", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(asset),
    });
    const result = await response.json() as {ok?: boolean; asset?: ReusableAsset; error?: string};
    if (!response.ok || !result.ok || !result.asset) throw new Error(result.error ?? "素材ライブラリへ登録できませんでした。");
    setAssetLibrary((current) => [result.asset!, ...current.filter((item) => item.storageKey !== result.asset!.storageKey)]);
  };

  const rememberDuplicateAsset = (ticket: UploadTicket) => {
    if (!ticket.asset) return;
    const asset: ReusableAsset = {...ticket.asset, url: ticket.readUrl};
    setAssetLibrary((current) => [asset, ...current.filter((item) => item.storageKey !== asset.storageKey)]);
  };

  const saveCurrentAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      setNotice({kind: "error", message: "テンプレート名を入力してください。"});
      return;
    }
    const backgroundMusic = project.backgroundMusic?.storageKey ? project.backgroundMusic : undefined;
    const chunks = project.chunks.map((chunk) => ({
      ...chunk,
      status: "draft" as const,
      audio: undefined,
      asset: undefined,
      assets: undefined,
    }));
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name, voice: project.voice, voiceStyle: project.voiceStyle, backgroundMusic, chunks}),
      });
      const result = await response.json() as {ok?: boolean; template?: ProjectTemplate; error?: string};
      if (!response.ok || !result.ok || !result.template) throw new Error(result.error ?? "テンプレートを保存できませんでした。");
      setTemplates((current) => [result.template!, ...current.filter((item) => item.id !== result.template!.id)]);
      setTemplateName("");
      setNotice({kind: "success", message: `テンプレート「${name}」を保存しました。`});
    } catch (error) {
      setNotice({kind: "error", message: error instanceof Error ? error.message : "テンプレートを保存できませんでした。"});
    }
  };

  const addLibraryImageToScene = (asset: ReusableAsset) => {
    if (!selected) return;
    if (selectedAssets.length >= 12) {
      setNotice({kind: "error", message: "1シーンに登録できる画像は12件までです。"});
      return;
    }
    if (selectedAssets.some((item) => item.storageKey === asset.storageKey)) {
      setNotice({kind: "info", message: "この素材はすでにシーンへ追加されています。"});
      return;
    }
    updateChunk(selected.id, {
      assets: [...(selected.assets ?? []), {name: asset.name, previewUrl: asset.url, storageKey: asset.storageKey}],
    });
    setNotice({kind: "success", message: `共有素材「${asset.name}」をシーンへ追加しました。`});
  };

  const applyLibraryImageAsBackground = (asset: ReusableAsset) => {
    setProject((current) => ({
      ...current,
      theme: {
        ...current.theme,
        backgroundImage: {name: asset.name, previewUrl: asset.url, storageKey: asset.storageKey},
      },
    }));
    setNotice({kind: "success", message: `共有素材「${asset.name}」を背景に設定しました。`});
  };

  const applyLibraryAudioAsBgm = (asset: ReusableAsset) => {
    setProject((current) => ({
      ...current,
      backgroundMusic: {
        name: asset.name,
        url: asset.url,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        volume: current.backgroundMusic?.volume ?? 0.2,
      },
    }));
    setNotice({kind: "success", message: `共有素材「${asset.name}」をBGMに設定しました。`});
  };

  const openProject = (value: LessonProject) => {
    setProject(value);
    setScript(value.chunks.map((chunk) => chunk.displayText).join("\n"));
    setSelectedId(value.chunks[0]?.id ?? "");
    setRenderUrl(undefined);
    setNotice(null);
    setActiveStep(value.chunks.length ? 3 : 2);
  };

  const prepareInitialProject = async () => {
    const chunks = parseScript(script, project.chunks);
    if (!chunks.length) {
      setNotice({kind: "error", message: "台本を1行以上入力してください。"});
      return;
    }

    setProject((current) => ({...current, chunks}));
    setSelectedId(chunks[0].id);
    setIsPreparing(true);
    try {
      if (generateOnSetup) {
        for (const chunk of chunks) await generateAudio(chunk);
      } else {
        setNotice({kind: "success", message: `${chunks.length}シーンの字幕と読み上げ文を作成しました。`});
      }
      setActiveStep(3);
    } finally {
      setIsPreparing(false);
    }
  };

  const applyScript = () => {
    const chunks = parseScript(script, project.chunks);
    setProject((current) => ({...current, chunks}));
    setSelectedId(chunks[0]?.id ?? "");
    setNotice(chunks.length ? {kind: "success", message: `${chunks.length}チャンクに整理しました。`} : {kind: "error", message: "台本を1行以上入力してください。"});
  };

  const moveChunk = (id: string, direction: -1 | 1) => {
    setProject((current) => {
      const index = current.chunks.findIndex((chunk) => chunk.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.chunks.length) return current;
      const chunks = [...current.chunks];
      [chunks[index], chunks[next]] = [chunks[next], chunks[index]];
      return {...current, chunks: chunks.map((chunk, order) => ({...chunk, order}))};
    });
  };

  const removeChunk = (id: string) => {
    setProject((current) => {
      const chunks = current.chunks.filter((chunk) => chunk.id !== id).map((chunk, order) => ({...chunk, order}));
      setSelectedId(chunks[0]?.id ?? "");
      return {...current, chunks};
    });
  };

  const addChunk = () => {
    const chunk: LessonChunk = {
      id: crypto.randomUUID(), order: project.chunks.length, displayText: "新しい解説文",
      speechText: "新しい解説文", durationInSeconds: 3, status: "draft",
    };
    setProject((current) => ({...current, chunks: [...current.chunks, chunk]}));
    setScript((current) => `${current.trim()}\n${chunk.displayText}`.trim());
    setSelectedId(chunk.id);
  };

  const addTextBlock = () => {
    if (!selected) return;
    const textBlocks = selected.textBlocks ?? [];
    if (textBlocks.length >= 10) {
      setNotice({kind: "error", message: "1シーンに追加できるテキストは10件までです。"});
      return;
    }
    updateChunk(selected.id, {textBlocks: [...textBlocks, {id: crypto.randomUUID(), text: "追加テキスト"}]});
  };

  const updateTextBlock = (id: string, text: string) => {
    if (!selected) return;
    updateChunk(selected.id, {textBlocks: (selected.textBlocks ?? []).map((block) => block.id === id ? {...block, text} : block)});
  };

  const removeTextBlock = (id: string) => {
    if (!selected) return;
    updateChunk(selected.id, {textBlocks: (selected.textBlocks ?? []).filter((block) => block.id !== id)});
  };

  const removeSceneAsset = (index: number) => {
    if (!selected) return;
    if (selected.asset && index === 0) {
      updateChunk(selected.id, {asset: undefined});
      return;
    }
    const assetIndex = index - (selected.asset ? 1 : 0);
    updateChunk(selected.id, {assets: (selected.assets ?? []).filter((_, currentIndex) => currentIndex !== assetIndex)});
  };

  const attachImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !selected) return;
    const existingCount = (selected.assets?.length ?? 0) + (selected.asset ? 1 : 0);
    if (existingCount + files.length > 12) {
      setNotice({kind: "error", message: "1シーンに登録できる画像は12件までです。"});
      event.target.value = "";
      return;
    }
    const invalid = files.map(imageValidationError).find(Boolean);
    if (invalid) {
      setNotice({kind: "error", message: invalid});
      event.target.value = "";
      return;
    }

    const chunkId = selected.id;
    let usedBrowserPreview = false;
    let reusedCount = 0;
    for (const file of files) {
      const localUrl = await readFileAsDataUrl(file);
      const contentHash = await fileSha256(file);
      const localAsset = {name: file.name, previewUrl: localUrl};
      setProject((current) => ({
        ...current,
        chunks: current.chunks.map((chunk) => chunk.id === chunkId
          ? {...chunk, assets: [...(chunk.assets ?? []), localAsset]}
          : chunk),
      }));
      try {
        const response = await fetch("/api/uploads", {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({projectId: project.id, fileName: file.name, contentType: file.type, size: file.size, contentHash}),
        });
        const result = await response.json() as UploadTicket;
        if (!response.ok || !result.ok) throw new Error(result.error);
        if (result.duplicate) {
          reusedCount += 1;
          rememberDuplicateAsset(result);
        } else {
          if (!result.uploadUrl) throw new Error("アップロードURLを取得できませんでした。");
          const upload = await fetch(result.uploadUrl, {method: "PUT", headers: {"Content-Type": file.type}, body: file});
          if (!upload.ok) throw new Error("R2へのアップロードに失敗しました。");
        }
        setProject((current) => ({
          ...current,
          chunks: current.chunks.map((chunk) => chunk.id === chunkId
            ? {...chunk, assets: (chunk.assets ?? []).map((asset) => asset.previewUrl === localUrl ? {name: file.name, previewUrl: result.readUrl, storageKey: result.key} : asset)}
            : chunk),
        }));
        if (!result.duplicate) {
          await registerReusableAsset({
            name: file.name,
            kind: "image",
            mimeType: file.type,
            url: result.readUrl,
            storageKey: result.key,
            contentHash,
          }).catch(() => undefined);
        }
      } catch {
        usedBrowserPreview = true;
      }
    }
    setNotice(usedBrowserPreview
      ? {kind: "info", message: "R2未設定の画像は、このブラウザ内でプレビューします。"}
      : {kind: "success", message: reusedCount
          ? `${files.length}件を追加しました。${reusedCount}件は同一素材の再アップロードを省略しました。`
          : `${files.length}件の画像を保存しました。`});
    event.target.value = "";
  };

  const attachBackgroundImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = imageValidationError(file);
    if (validationError) {
      setNotice({kind: "error", message: validationError});
      event.target.value = "";
      return;
    }

    const localUrl = await readFileAsDataUrl(file);
    const contentHash = await fileSha256(file);
    setProject((current) => ({
      ...current,
      theme: {...current.theme, backgroundImage: {name: file.name, previewUrl: localUrl}},
    }));

    try {
      const response = await fetch("/api/uploads", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({projectId: project.id, fileName: file.name, contentType: file.type, size: file.size, contentHash}),
      });
      const result = await response.json() as UploadTicket;
      if (!response.ok || !result.ok) throw new Error(result.error);
      if (result.duplicate) {
        rememberDuplicateAsset(result);
      } else {
        if (!result.uploadUrl) throw new Error("アップロードURLを取得できませんでした。");
        const upload = await fetch(result.uploadUrl, {method: "PUT", headers: {"Content-Type": file.type}, body: file});
        if (!upload.ok) throw new Error("R2へのアップロードに失敗しました。");
      }
      setProject((current) => ({
        ...current,
        theme: {...current.theme, backgroundImage: {name: file.name, previewUrl: result.readUrl, storageKey: result.key}},
      }));
      if (!result.duplicate) {
        await registerReusableAsset({
          name: file.name,
          kind: "image",
          mimeType: file.type,
          url: result.readUrl,
          storageKey: result.key,
          contentHash,
        }).catch(() => undefined);
      }
      setNotice({kind: "success", message: result.duplicate ? "同一素材があるため再アップロードせず、共有素材を背景に設定しました。" : "背景画像をR2へ保存しました。"});
    } catch {
      setNotice({kind: "info", message: "R2未設定のため、背景画像はこのブラウザ内でプレビューします。"});
    } finally {
      event.target.value = "";
    }
  };

  const attachBackgroundMusic = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = backgroundMusicValidationError(file);
    if (validationError) {
      setNotice({kind: "error", message: validationError});
      event.target.value = "";
      return;
    }

    const localUrl = await readFileAsDataUrl(file);
    const contentHash = await fileSha256(file);
    setProject((current) => ({
      ...current,
      backgroundMusic: {name: file.name, url: localUrl, mimeType: file.type, volume: 0.2},
    }));

    try {
      const response = await fetch("/api/uploads", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({projectId: project.id, fileName: file.name, contentType: file.type, size: file.size, contentHash}),
      });
      const result = await response.json() as UploadTicket;
      if (!response.ok || !result.ok) throw new Error(result.error);
      if (result.duplicate) {
        rememberDuplicateAsset(result);
      } else {
        if (!result.uploadUrl) throw new Error("アップロードURLを取得できませんでした。");
        const upload = await fetch(result.uploadUrl, {method: "PUT", headers: {"Content-Type": file.type}, body: file});
        if (!upload.ok) throw new Error("R2へのアップロードに失敗しました。");
      }
      setProject((current) => ({
        ...current,
        backgroundMusic: current.backgroundMusic?.url === localUrl
          ? {...current.backgroundMusic, url: result.readUrl, storageKey: result.key}
          : current.backgroundMusic,
      }));
      if (!result.duplicate) {
        await registerReusableAsset({
          name: file.name,
          kind: "audio",
          mimeType: file.type,
          url: result.readUrl,
          storageKey: result.key,
          contentHash,
        }).catch(() => undefined);
      }
      setNotice({kind: "success", message: result.duplicate ? "同一BGMがあるため再アップロードせず、共有BGMを設定しました。" : "BGMをR2へ保存しました。"});
    } catch {
      setNotice({kind: "info", message: "R2未設定のため、BGMはこのブラウザ内でプレビューします。"});
    } finally {
      event.target.value = "";
    }
  };

  const generateAudio = async (chunk: LessonChunk) => {
    updateChunk(chunk.id, {status: "generating"});
    try {
      const response = await fetch("/api/tts", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({projectId: project.id, chunkId: chunk.id, text: chunk.speechText, voice: chunk.voice ?? project.voice, style: chunk.voiceStyle ?? project.voiceStyle}),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error);
      updateChunk(chunk.id, {
        status: "ready",
        durationInSeconds: result.durationInSeconds,
        audio: {url: result.url, storageKey: result.storageKey, mimeType: result.mimeType},
      });
      setNotice({kind: "success", message: `チャンク ${chunk.order + 1} の音声を生成しました。`});
    } catch (error) {
      updateChunk(chunk.id, {status: "error"});
      setNotice({kind: "error", message: error instanceof Error ? error.message : "音声生成に失敗しました。"});
    }
  };

  const generateAllAudio = async () => {
    for (const chunk of project.chunks) {
      if (!chunk.audio) await generateAudio(chunk);
    }
  };

  const downloadProjectFile = () => {
    const validation = projectSchema.safeParse(project);
    if (!validation.success) {
      setNotice({kind: "error", message: projectFileErrorMessage(validation.error)});
      return;
    }

    const blob = new Blob([serializeProjectFile(validation.data)], {type: "application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = projectFileName(validation.data.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice({kind: "success", message: "Remotion用JSONをダウンロードしました。"});
  };

  const uploadProjectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 256 * 1024 * 1024) {
        throw new Error("JSONファイルは256MB以下にしてください。");
      }
      const imported = parseProjectFile(JSON.parse(await file.text()));
      setProject(imported);
      setScript(imported.chunks.map((chunk) => chunk.displayText).join("\n"));
      setSelectedId(imported.chunks[0]?.id ?? "");
      replaceRenderUrl();
      playerRef.current?.seekTo(0);
      setActiveStep(3);
      setNotice({kind: "success", message: `「${imported.title}」をJSONから読み込みました。`});
    } catch (error) {
      setNotice({kind: "error", message: projectFileErrorMessage(error)});
    } finally {
      event.target.value = "";
    }
  };

  const renderVideo = async () => {
    if (!project.chunks.length) return;
    setIsRendering(true);
    replaceRenderUrl();
    setNotice({kind: "info", message: "フレーム生成とエンコードを開始しました。この画面を開いたままお待ちください。"});
    try {
      const response = await fetch("/api/render", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(project),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({error: "レンダリングに失敗しました。"})) as {error?: string};
        throw new Error(result.error ?? "レンダリングに失敗しました。");
      }
      const video = await response.blob();
      if (!video.size) throw new Error("書き出した動画を取得できませんでした。");
      replaceRenderUrl(URL.createObjectURL(video));
      setNotice({kind: "success", message: "MP4を書き出しました。動画はR2へ保存されず、このブラウザから直接保存できます。"});
    } catch (error) {
      setNotice({kind: "error", message: error instanceof Error ? error.message : "レンダリングに失敗しました。"});
    } finally {
      setIsRendering(false);
    }
  };

  const statusTone = notice?.kind === "error" ? "border-red-300 bg-red-50 text-red-800" : notice?.kind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-stone-300 bg-white text-stone-700";

  return (
    <main className="lesson-frame-app">
      <a className="skip-link" href="#studio-main">編集画面へ移動</a>
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><FilmSlate size={23} weight="fill" /></div>
          <span className="brand-name">Lesson Frame</span>
          <span className="brand-divider" aria-hidden="true" />
          {activeStep === 1 ? (
            <span className="project-title project-title--static">プロジェクト一覧</span>
          ) : (
            <input aria-label="プロジェクト名" value={project.title} onChange={(event) => setProject({...project, title: event.target.value})} className="project-title" />
          )}
        </div>
        <div className="header-actions">
          <span className="save-state"><CheckCircle size={18} weight="fill" />{activeStep === 1 ? `${projects.length} projects` : saveState}</span>
          <input ref={projectFileInputRef} type="file" className="hidden" accept="application/json,.json" onChange={uploadProjectFile} />
          <button type="button" className="toolbar-button" onClick={() => projectFileInputRef.current?.click()} title="Remotion用JSONを読み込む"><UploadSimple size={18} /><span>JSON読込</span></button>
          <button type="button" className="toolbar-button" onClick={downloadProjectFile} title="Remotion用JSONを保存する" disabled={!project.title.trim()}><DownloadSimple size={18} /><span>JSON保存</span></button>
          <button type="button" className="toolbar-button" onClick={() => { setActiveStep(3); setInspectorTab("image"); }} disabled={!project.chunks.length}><GearSix size={18} /><span>設定</span></button>
        </div>
      </header>

      <nav className="workflow-nav" aria-label="制作ステップ">
        <button type="button" className={"workflow-step " + (activeStep === 1 ? "is-active" : "")} onClick={() => { setActiveStep(1); setIsCreatingProject(false); }}><span>1</span>プロジェクト</button>
        <button type="button" className={"workflow-step " + (activeStep === 2 ? "is-active" : "")} onClick={() => setActiveStep(2)} disabled={!project.title.trim()}><span>2</span>初期設定</button>
        <button type="button" className={"workflow-step " + (activeStep === 3 ? "is-active" : "")} onClick={() => setActiveStep(3)} disabled={!project.chunks.length}><span>3</span>シーン編集</button>
        <button type="button" className={"workflow-step " + (activeStep === 4 ? "is-active" : "")} onClick={() => setActiveStep(4)} disabled={!project.chunks.length}><span>4</span>書き出し</button>
      </nav>

      {notice && (
        <div className={"notice-bar " + statusTone} role={notice.kind === "error" ? "alert" : "status"}>
          <div>{notice.kind === "error" ? <WarningCircle size={18} /> : <CheckCircle size={18} />}<span>{notice.message}</span></div>
          <button type="button" onClick={() => setNotice(null)}>閉じる</button>
        </div>
      )}

      {activeStep === 1 ? (
        <section id="studio-main" className="projects-screen">
          <div className="projects-heading">
            <div>
              <span className="step-kicker">Projects</span>
              <h1>プロジェクト一覧</h1>
              <p>作成中の解説動画を選んで編集を再開できます。</p>
            </div>
            <button type="button" className="primary-button projects-new-button" onClick={() => setIsCreatingProject(true)}>
              <Plus size={18} />新規作成
            </button>
          </div>

          {isCreatingProject && (
            <section className="new-project-panel" aria-label="新しいプロジェクト">
              <div>
                <span className="eyebrow">New project</span>
                <h2>新しいプロジェクト</h2>
                <p>動画のテーマや授業名を入力してください。</p>
              </div>
              <div className="new-project-form">
                <label className="setup-label" htmlFor="new-project-title">プロジェクト名</label>
                <input
                  id="new-project-title"
                  className="field setup-title-input"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="例：気体の状態方程式"
                  maxLength={120}
                  autoFocus
                  onKeyDown={(event) => { if (event.key === "Enter") startNewProject(); }}
                />
                <label className="setup-label new-project-template-label" htmlFor="new-project-template">テンプレート</label>
                <select
                  id="new-project-template"
                  className="field"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                >
                  <option value="">テンプレートなし</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <p className="template-select-help">
                  {selectedTemplateId
                    ? (() => {
                        const template = templates.find((item) => item.id === selectedTemplateId);
                        return template
                          ? `${template.voice} · 初期チャンク ${template.chunks.length}件${template.backgroundMusic ? " · BGMあり" : ""}`
                          : "保存済みテンプレートを選択できます。";
                      })()
                    : templates.length
                      ? "保存済みのナレーター、読み上げ方、BGM、初期チャンクを引き継げます。"
                      : "テンプレートはプロジェクトの全体設定から保存できます。"}
                </p>
                <div className="new-project-form__actions">
                  <button type="button" className="text-button" onClick={() => { setIsCreatingProject(false); setNewProjectName(""); setSelectedTemplateId(""); }}>キャンセル</button>
                  <button type="button" className="primary-button setup-next" onClick={startNewProject} disabled={!newProjectName.trim()}>初期設定へ進む</button>
                </div>
              </div>
            </section>
          )}

          {projects.length === 0 ? (
            <div className="projects-empty">
              <div className="projects-empty__mark"><FilmSlate size={30} weight="fill" /></div>
              <h2>まだプロジェクトがありません</h2>
              <p>右上の「新規作成」から、最初の解説動画を作成してください。</p>
              <button type="button" className="secondary-button" onClick={() => setIsCreatingProject(true)}><Plus size={16} />プロジェクトを作成</button>
            </div>
          ) : (
            <div className="projects-list">
              <div className="projects-list__header"><span>プロジェクト</span><span>シーン</span><span>音声</span><span>長さ</span><span /></div>
              {projects.map((item) => {
                const itemReadyCount = item.chunks.filter((chunk) => chunk.audio).length;
                return (
                  <article className="project-row" key={item.id}>
                    <div className="project-row__identity">
                      <div className="project-row__thumbnail"><FilmSlate size={22} weight="fill" /></div>
                      <div><h2>{item.title}</h2><p>{item.chunks[0]?.displayText || "初期設定を続けてください"}</p></div>
                    </div>
                    <span className="project-row__metric">{item.chunks.length}</span>
                    <span className="project-row__metric">{itemReadyCount}/{item.chunks.length}</span>
                    <span className="project-row__metric">{formatDuration(totalDuration(item.chunks, item.gapInSeconds))}</span>
                    <button type="button" className="secondary-button" onClick={() => openProject(item)}>{item.chunks.length ? "編集を再開" : "初期設定へ"}</button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : activeStep === 2 ? (
        <section id="studio-main" className="setup-screen setup-screen--initial">
          <div className="setup-page-heading">
            <div><span className="step-kicker">Step 02</span><h1>台本とナレーターを設定</h1></div>
            <p>改行ごとに1チャンクを作成し、同じ単位で字幕と読み上げ音声を管理します。</p>
          </div>
          <div className="initial-setup-grid">
            <section className="initial-panel initial-panel--script">
              <div className="initial-panel__heading">
                <div><span className="eyebrow">Script</span><h2>台本テキスト</h2></div>
                <span>{parseScript(script).length}チャンク</span>
              </div>
              <textarea
                className="field initial-script-input"
                value={script}
                onChange={(event) => setScript(event.target.value)}
                placeholder={sampleScript}
                aria-label="初期設定の台本"
              />
              <p className="field-help">1行を1チャンクとして扱います。空行は無視されます。LaTeXはそのまま入力できます。</p>
            </section>

            <section className="initial-panel initial-panel--voice">
              <div className="initial-panel__heading"><div><span className="eyebrow">Narrator</span><h2>ナレーター</h2></div></div>
              <div className="form-group">
                <div className="field-heading"><label htmlFor="setup-voice">Gemini TTS キャラクター</label><span>{selectedVoice?.description}</span></div>
                <select id="setup-voice" className="field" value={project.voice} onChange={(event) => updateVoiceSettings({voice: event.target.value})}>
                  {GEMINI_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.id}・{voice.description}</option>)}
                </select>
              </div>
              <div className="form-group">
                <div className="field-heading"><label htmlFor="setup-voice-style">読み上げ方</label><span>{project.voiceStyle.length}/300</span></div>
                <textarea id="setup-voice-style" className="field text-area setup-style-input" maxLength={300} value={project.voiceStyle} onChange={(event) => updateVoiceSettings({voiceStyle: event.target.value})} />
                <div className="example-list">{VOICE_STYLE_EXAMPLES.map((example, index) => <button type="button" key={example} onClick={() => updateVoiceSettings({voiceStyle: example})}>例 {index + 1}</button>)}</div>
              </div>
              <label className="setup-audio-option">
                <input type="checkbox" checked={generateOnSetup} onChange={(event) => setGenerateOnSetup(event.target.checked)} />
                <span><strong>初期設定で音声もまとめて生成</strong><small>字幕と読み上げ文の作成後、各チャンクの音声を順番に生成します。</small></span>
              </label>
            </section>
          </div>
          <div className="setup-footer-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveStep(1)}>戻る</button>
            <button type="button" className="primary-button setup-next" disabled={isPreparing || !script.trim()} onClick={() => void prepareInitialProject()}>
              {isPreparing ? <SpinnerGap size={18} className="animate-spin" /> : <MagicWand size={18} />}
              {isPreparing ? "チャンクと音声を作成中" : generateOnSetup ? "字幕と音声を作成" : "チャンクを作成"}
            </button>
          </div>
        </section>
      ) : activeStep === 4 ? (
        <section id="studio-main" className="export-screen">
          <div className="export-main">
            <div className="setup-page-heading export-heading">
              <div><span className="step-kicker">Step 04</span><h1>最終チェックと書き出し</h1></div>
              <p>映像、字幕、音声を確認してからMP4を書き出します。</p>
            </div>
            <div className="export-player player-frame">
              <Player ref={playerRef} component={LessonComposition} inputProps={{project}} durationInFrames={durationInFrames} compositionWidth={project.width} compositionHeight={project.height} fps={project.fps} controls style={{width: "100%", aspectRatio: "16 / 9"}} acknowledgeRemotionLicense />
            </div>
            <div className="export-specs"><span>1920 × 1080</span><span>30 fps</span><span>H.264 / AAC</span><span>{formatDuration(duration)}</span></div>
          </div>

          <aside className="export-review">
            <span className="eyebrow">Final review</span>
            <h2>{project.title}</h2>
            <p>不足項目は警告として表示しますが、そのまま書き出すこともできます。</p>
            <div className="review-list">
              <div className="review-item is-ready"><CheckCircle size={20} weight="fill" /><span><strong>プロジェクト</strong><small>{project.chunks.length}シーン・{formatDuration(duration)}</small></span></div>
              <div className={"review-item " + (incompleteTextCount === 0 ? "is-ready" : "is-warning")}>
                {incompleteTextCount === 0 ? <CheckCircle size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}
                <span><strong>字幕・読み上げ文</strong><small>{incompleteTextCount === 0 ? "すべて入力済み" : `${incompleteTextCount}シーンを確認`}</small></span>
              </div>
              <div className={"review-item " + (missingAudioCount === 0 ? "is-ready" : "is-warning")}>
                {missingAudioCount === 0 ? <CheckCircle size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}
                <span><strong>音声</strong><small>{missingAudioCount === 0 ? `${readyCount}件すべて生成済み` : `${missingAudioCount}件が未生成`}</small></span>
              </div>
              <div className="review-item is-ready"><MusicNotes size={20} weight="fill" /><span><strong>全体BGM</strong><small>{project.backgroundMusic ? `${project.backgroundMusic.name}・音量 ${Math.round(project.backgroundMusic.volume * 100)}%` : "未設定（任意）"}</small></span></div>
              <div className="review-item is-ready"><CheckCircle size={20} weight="fill" /><span><strong>出力形式</strong><small>MP4・YouTube landscape</small></span></div>
            </div>
            {(missingAudioCount > 0 || incompleteTextCount > 0) && (
              <><p className="export-warning-note">未入力のテキストは空白、未生成の音声は無音として書き出されます。</p><button type="button" className="secondary-button full-width" onClick={() => setActiveStep(3)}>シーン編集で修正する</button></>
            )}
            <button type="button" className="generate-audio-button export-button" disabled={isRendering} onClick={renderVideo}>
              {isRendering ? <SpinnerGap size={19} className="animate-spin" /> : <FilmSlate size={19} />}{isRendering ? "書き出し中" : "MP4を書き出す"}
            </button>
            {renderUrl && <a className="secondary-button full-width export-download" href={renderUrl} download={`${project.title || "lesson-frame"}.mp4`}><DownloadSimple size={17} />完成動画を保存</a>}
            <button type="button" className="text-button export-back" onClick={() => setActiveStep(3)}>シーン編集へ戻る</button>
          </aside>
        </section>
      ) : (
      <div id="studio-main" className="studio-shell">
        <aside className="scene-panel panel-scroll">
          <div className="panel-heading">
            <div><span className="eyebrow">Scenes</span><h2>シーン</h2></div>
            <button type="button" className="square-button" aria-label="シーンを追加" onClick={addChunk}><Plus size={18} /></button>
          </div>
          <details className="bulk-script">
            <summary><MagicWand size={15} />台本を一括編集</summary>
            <div className="bulk-script__body">
              <p>改行ごとに1シーンとして整理します。</p>
              <textarea className="field bulk-script__textarea" value={script} onChange={(event) => setScript(event.target.value)} aria-label="台本" />
              <button type="button" className="secondary-button full-width" onClick={applyScript}>シーンへ反映</button>
            </div>
          </details>
          <div className="scene-list">
            {project.chunks.length === 0 ? (
              <div className="empty-state"><Waveform size={30} /><p>台本を入力すると、ここにシーンが並びます。</p></div>
            ) : project.chunks.map((chunk) => {
              const isSelected = selected?.id === chunk.id;
              const audioLabel = chunk.status === "generating" ? "音声生成中" : chunk.status === "error" ? "音声エラー" : chunk.audio ? "音声生成済み" : "音声未生成";
              const previewAsset = chunk.assets?.[0] ?? chunk.asset;
              return (
                <button type="button" key={chunk.id} onClick={() => selectChunk(chunk.id)} className={"scene-card " + (isSelected ? "is-selected" : "")}>
                  <span className="scene-number">{String(chunk.order + 1).padStart(2, "0")}</span>
                  <span className="scene-thumbnail">
                    {previewAsset ? <Image src={previewAsset.previewUrl} alt={previewAsset.name} width={112} height={72} unoptimized /> : <span>{chunk.displayText.includes("$") ? "PV = nRT" : chunk.displayText.slice(0, 18)}</span>}
                  </span>
                  <span className="scene-copy">
                    <strong>{chunk.displayText}</strong>
                    <span className="scene-meta"><span>{chunk.durationInSeconds.toFixed(1)}秒</span><span className={"audio-state audio-state--" + chunk.status}><SpeakerHigh size={13} />{audioLabel}</span></span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="scene-panel__footer"><span>{project.chunks.length}シーン</span><span>{formatDuration(duration)}</span></div>
        </aside>

        <section className="preview-panel">
          <div className="preview-heading">
            <div><span className="eyebrow">Live preview</span><h1>プレビュー</h1></div>
            <button type="button" className="secondary-button" onClick={() => setInspectorTab("image")}><GearSix size={17} />デザイン設定</button>
          </div>
          <div className="player-frame">
            {project.chunks.length ? (
              <Player ref={playerRef} component={LessonComposition} inputProps={{project}} durationInFrames={durationInFrames} compositionWidth={project.width} compositionHeight={project.height} fps={project.fps} controls style={{width: "100%", aspectRatio: "16 / 9"}} acknowledgeRemotionLicense />
            ) : <div className="player-empty">台本を入力してください</div>}
          </div>
          <div className="transport-bar">
            <button type="button" className="transport-play" aria-label="プレビューを再生" onClick={() => playerRef.current?.play()}><Play size={19} weight="fill" /></button>
            <span className="transport-time">00:00 / {formatDuration(duration)}</span>
            <span className="transport-track"><span /></span>
            <div className="scene-navigation">
              <button type="button" className="secondary-button" disabled={!selected || selected.order === 0} onClick={() => selected && selectChunk(project.chunks[selected.order - 1].id)}>前のシーン</button>
              <button type="button" className="secondary-button" disabled={!selected || selected.order >= project.chunks.length - 1} onClick={() => selected && selectChunk(project.chunks[selected.order + 1].id)}>次のシーン</button>
            </div>
          </div>
          {isRendering && <div className="render-progress"><div><span>フレームをエンコードしています</span><span>H.264 / 1080p</span></div><div className="render-shimmer" /></div>}
          <footer className="preview-footer">
            <div><strong>1920 × 1080</strong><span>YouTube landscape</span></div>
            <div><strong>30 fps · H.264</strong><span>AAC audio</span></div>
            <div id="export-actions" className="preview-footer__actions">
              {renderUrl && <a className="secondary-button" href={renderUrl} download={`${project.title || "lesson-frame"}.mp4`}><DownloadSimple size={16} />MP4保存</a>}
              <button type="button" className="primary-button" onClick={() => setActiveStep(4)}><FilmSlate size={17} />最終チェックへ</button>
            </div>
          </footer>
        </section>

        <aside className="inspector-panel panel-scroll">
          <div className="inspector-tabs" role="tablist" aria-label="シーン編集">
            <button type="button" role="tab" aria-selected={inspectorTab === "script"} className={inspectorTab === "script" ? "is-active" : ""} onClick={() => setInspectorTab("script")}>個別設定</button>
            <button type="button" role="tab" aria-selected={inspectorTab === "image"} className={inspectorTab === "image" ? "is-active" : ""} onClick={() => setInspectorTab("image")}>全体設定</button>
          </div>

          {selected ? (
            inspectorTab === "script" ? (
              <div className="inspector-content" role="tabpanel">
                <div className="inspector-title-row">
                  <div><span className="eyebrow">Scene {String(selected.order + 1).padStart(2, "0")}</span><h2>個別設定</h2></div>
                  <div className="inline-actions">
                    <button type="button" className="square-button" aria-label="上へ移動" onClick={() => moveChunk(selected.id, -1)}><ArrowUp size={16} /></button>
                    <button type="button" className="square-button" aria-label="下へ移動" onClick={() => moveChunk(selected.id, 1)}><ArrowDown size={16} /></button>
                    <button type="button" className="square-button danger" aria-label="削除" onClick={() => removeChunk(selected.id)}><Trash size={16} /></button>
                  </div>
                </div>

                <div className="settings-section-heading"><span>このチャンク</span><h3>テキスト</h3></div>

                <div className="form-group">
                  <div className="field-heading"><label htmlFor="display-text">表示テキスト</label><span>{selected.displayText.length}/300</span></div>
                  <textarea id="display-text" className="field text-area text-area--display" maxLength={300} value={selected.displayText} onChange={(event) => updateChunk(selected.id, {displayText: event.target.value, status: "draft"})} />
                  <p className="field-help">数式は <code>$PV=nRT$</code> または <code>$$...$$</code> で入力できます。</p>
                </div>

                <div className="form-group extra-text-section">
                  <div className="field-heading">
                    <label>追加テキスト</label>
                    <button type="button" className="inline-add-button" onClick={addTextBlock}><Plus size={13} />追加</button>
                  </div>
                  {(selected.textBlocks ?? []).length === 0 ? (
                    <p className="inline-empty">補足、式、注釈などをこのシーンだけに追加できます。</p>
                  ) : (
                    <div className="extra-text-list">
                      {(selected.textBlocks ?? []).map((block, index) => (
                        <div className="extra-text-row" key={block.id}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <textarea className="field" maxLength={300} value={block.text} onChange={(event) => updateTextBlock(block.id, event.target.value)} aria-label={`追加テキスト ${index + 1}`} />
                          <button type="button" className="square-button danger" aria-label={`追加テキスト ${index + 1}を削除`} onClick={() => removeTextBlock(block.id)}><Trash size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" className="ai-link" onClick={() => {
                  const speechText = toSpeechText(selected.displayText);
                  updateChunk(selected.id, {speechText, durationInSeconds: estimateDuration(speechText), status: "draft", audio: undefined});
                }}>
                  <span><LinkSimple size={16} />AI連携</span><span>表示文から自動生成</span>
                </button>

                <div className="settings-section-heading"><span>このチャンク</span><h3>音声</h3></div>

                <div className="form-group">
                  <div className="field-heading"><label htmlFor="speech-text">読み上げテキスト</label><span>{selected.speechText.length}/500</span></div>
                  <textarea id="speech-text" className="field text-area" maxLength={500} value={selected.speechText} onChange={(event) => updateChunk(selected.id, {speechText: event.target.value, durationInSeconds: estimateDuration(event.target.value), status: "draft", audio: undefined})} />
                </div>

                <div className="form-group">
                  <div className="field-heading"><label htmlFor="gemini-voice">Gemini TTS</label><span>{selectedVoice?.description}</span></div>
                  <select id="gemini-voice" className="field" value={selectedVoiceId} onChange={(event) => updateChunk(selected.id, {voice: event.target.value, status: "draft", audio: undefined})}>
                    {GEMINI_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.id}・{voice.description}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <div className="field-heading"><label htmlFor="voice-style">読み上げ方</label><span>{selectedVoiceStyle.length}/300</span></div>
                  <textarea id="voice-style" className="field text-area text-area--style" maxLength={300} value={selectedVoiceStyle} onChange={(event) => updateChunk(selected.id, {voiceStyle: event.target.value, status: "draft", audio: undefined})} placeholder="話す速さ、口調、強調したい箇所を自然文で指定します。" />
                  <div className="example-list" aria-label="読み上げ方の例">{VOICE_STYLE_EXAMPLES.map((example, index) => <button type="button" key={example} onClick={() => updateChunk(selected.id, {voiceStyle: example, status: "draft", audio: undefined})}>例 {index + 1}</button>)}</div>
                </div>

                <button type="button" className="generate-audio-button" disabled={selected.status === "generating"} onClick={() => generateAudio(selected)}>
                  {selected.status === "generating" ? <SpinnerGap className="animate-spin" size={20} /> : <Waveform size={21} />}
                  {selected.status === "generating" ? "音声を生成中" : selected.audio ? "音声を再生成" : "音声を生成"}
                </button>
                <div className={"audio-preview " + (selected.audio ? "has-audio" : "")}>
                  <div className="audio-preview__heading"><span>生成された音声</span><span>{selected.durationInSeconds.toFixed(1)}秒</span></div>
                  {selected.audio ? <audio controls src={selected.audio.url}>音声を再生できません。</audio> : <p><SpeakerHigh size={18} />まだ音声は生成されていません。</p>}
                </div>
                <button type="button" className="secondary-button full-width" onClick={generateAllAudio}><SpeakerHigh size={16} />未生成の音声をすべて作る</button>

                <div className="settings-section-heading"><span>このチャンク</span><h3>シーン素材</h3></div>
                <section className="asset-section">
                  <div className="field-heading"><h3>画像</h3><span>{selectedAssets.length}/12</span></div>
                  {selectedAssets.length > 0 && (
                    <div className="asset-grid">
                      {selectedAssets.map((asset, index) => (
                        <div className="asset-card" key={`${asset.previewUrl}-${index}`}>
                          <Image src={asset.previewUrl} alt={`教材素材 ${index + 1}`} width={640} height={360} unoptimized />
                          <div><span>{String(index + 1).padStart(2, "0")} · {asset.name}</span><button type="button" onClick={() => removeSceneAsset(index)}>削除</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedAssets.length < 12 && (
                    <label className="upload-dropzone upload-dropzone--add"><UploadSimple size={24} /><strong>{selectedAssets.length ? "素材を追加" : "画像を選択"}</strong><span>複数選択可 · PNG / JPEG / WebP · 1枚20MBまで</span><input type="file" multiple className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={attachImages} /></label>
                  )}
                  <div className="asset-library">
                    <div className="asset-library__heading"><strong>共有素材ギャラリー</strong><span>{imageLibrary.length}件</span></div>
                    {imageLibrary.length > 0 ? (
                      <div className="library-grid">
                        {imageLibrary.map((asset) => (
                          <button
                            type="button"
                            className="library-item"
                            key={asset.id}
                            onClick={() => addLibraryImageToScene(asset)}
                            disabled={selectedAssets.length >= 12 || selectedAssets.some((item) => item.storageKey === asset.storageKey)}
                            aria-label={`${asset.name}をシーンへ挿入`}
                          >
                            <Image src={asset.url} alt={asset.name} width={320} height={180} unoptimized />
                            <span className="library-item__meta"><span title={asset.name}>{asset.name}</span><small>{selectedAssets.some((item) => item.storageKey === asset.storageKey) ? "追加済み" : "クリックで挿入"}</small></span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="gallery-empty"><FileImage size={22} /><span>アップロードした画像がここに表示されます。</span></div>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="inspector-content" role="tabpanel">
                <div className="inspector-title-row"><div><span className="eyebrow">Project settings</span><h2>全体設定</h2></div></div>
                <section className="asset-section">
                  <div className="field-heading"><h3>全体BGM</h3><span>動画全体・ループ</span></div>
                  {project.backgroundMusic ? (
                    <div className="bgm-card">
                      <div className="bgm-card__heading"><span><MusicNotes size={18} weight="fill" /><strong>{project.backgroundMusic.name}</strong></span><button type="button" onClick={() => setProject((current) => ({...current, backgroundMusic: undefined}))}>削除</button></div>
                      <audio controls src={project.backgroundMusic.url}>BGMを再生できません。</audio>
                      <label className="volume-control">
                        <span><strong>BGM音量</strong><small>{Math.round(project.backgroundMusic.volume * 100)}%</small></span>
                        <input type="range" min="0" max="100" step="1" value={Math.round(project.backgroundMusic.volume * 100)} onChange={(event) => setProject((current) => current.backgroundMusic ? {...current, backgroundMusic: {...current.backgroundMusic, volume: Number(event.target.value) / 100}} : current)} />
                      </label>
                    </div>
                  ) : (
                    <label className="upload-dropzone upload-dropzone--compact"><MusicNotes size={24} /><strong>BGMを選択</strong><span>MP3 / WAV / M4A / AAC / OGG · 50MBまで</span><input type="file" className="sr-only" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/vnd.wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,application/ogg,.mp3,.wav,.m4a,.aac,.ogg" onChange={attachBackgroundMusic} /></label>
                  )}
                  <div className="asset-library">
                    <div className="asset-library__heading"><strong>共有BGMギャラリー</strong><span>{audioLibrary.length}件</span></div>
                    {audioLibrary.length > 0 ? (
                      <div className="audio-library-list">
                        {audioLibrary.map((asset) => (
                          <button
                            type="button"
                            className={project.backgroundMusic?.storageKey === asset.storageKey ? "is-active" : ""}
                            key={asset.id}
                            onClick={() => applyLibraryAudioAsBgm(asset)}
                          >
                            <span><MusicNotes size={15} /><strong>{asset.name}</strong></span>
                            <small>{project.backgroundMusic?.storageKey === asset.storageKey ? "使用中" : "使用する"}</small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="gallery-empty"><MusicNotes size={22} /><span>アップロードしたBGMがここに表示されます。</span></div>
                    )}
                  </div>
                </section>
                <section className="asset-section">
                  <div className="field-heading"><h3>背景画像</h3><span>動画全体</span></div>
                  {project.theme.backgroundImage ? (
                    <div className="asset-card"><Image src={project.theme.backgroundImage.previewUrl} alt="動画の背景画像" width={640} height={360} unoptimized /><div><span>{project.theme.backgroundImage.name}</span><button type="button" onClick={() => setProject((current) => ({...current, theme: {...current.theme, backgroundImage: undefined}}))}>削除</button></div></div>
                  ) : (
                    <label className="upload-dropzone upload-dropzone--compact"><UploadSimple size={24} /><strong>背景画像を選択</strong><span>PNG / JPEG / WebP · 20MBまで</span><input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={attachBackgroundImage} /></label>
                  )}
                  <div className="asset-library">
                    <div className="asset-library__heading"><strong>共有素材ギャラリー</strong><span>{imageLibrary.length}件</span></div>
                    {imageLibrary.length > 0 ? (
                      <div className="library-grid library-grid--compact">
                        {imageLibrary.map((asset) => (
                          <button
                            type="button"
                            className="library-item"
                            key={asset.id}
                            onClick={() => applyLibraryImageAsBackground(asset)}
                            aria-label={`${asset.name}を背景へ設定`}
                          >
                            <Image src={asset.url} alt={asset.name} width={320} height={180} unoptimized />
                            <span className="library-item__meta"><span title={asset.name}>{asset.name}</span><small>{project.theme.backgroundImage?.storageKey === asset.storageKey ? "使用中" : "クリックで使用"}</small></span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="gallery-empty"><FileImage size={22} /><span>アップロードした画像がここに表示されます。</span></div>
                    )}
                  </div>
                </section>
                <section className="asset-section">
                  <h3>背景スタイル</h3>
                  <div className="theme-options">
                    {(["blueprint", "chalk", "paper"] as const).map((background) => (
                      <button type="button" key={background} className={project.theme.background === background ? "is-active" : ""} onClick={() => setProject({...project, theme: {...project.theme, background}})}>
                        <span className={"theme-swatch theme-swatch--" + background} />{background === "blueprint" ? "設計図" : background === "chalk" ? "黒板" : "紙"}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="asset-section settings-list">
                  <h3>表示設定</h3>
                  <label><span><strong>本文を表示</strong><small>画面内のメインテキスト</small></span><input type="checkbox" checked={project.theme.showMainText} onChange={(event) => setProject({...project, theme: {...project.theme, showMainText: event.target.checked}})} /></label>
                </section>
                <section className="asset-section template-section">
                  <div className="field-heading"><h3>プロジェクトテンプレート</h3><span>{templates.length}件</span></div>
                  <p className="template-section__help">現在のナレーター、読み上げ方、共有BGM、初期チャンクを、新規作成時に呼び出せる設定として保存します。</p>
                  <div className="template-save-form">
                    <input className="field" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="例：理科・標準テンプレート" maxLength={80} />
                    <button type="button" className="secondary-button" onClick={saveCurrentAsTemplate} disabled={!templateName.trim()}><Plus size={15} />保存</button>
                  </div>
                  {project.backgroundMusic && !project.backgroundMusic.storageKey && <p className="field-help">ブラウザ内だけのBGMはテンプレートへ含まれません。R2へ保存された共有BGMを選択してください。</p>}
                </section>
              </div>
            )
          ) : (
            <div className="empty-state empty-state--inspector"><FileImage size={34} /><p>編集するシーンを選択してください。</p></div>
          )}
        </aside>
      </div>
      )}
    </main>
  );
}
