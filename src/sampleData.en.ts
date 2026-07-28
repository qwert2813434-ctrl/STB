import type { Project } from "./model";
import { normalizeProject } from "./model";

// 英文示範案：結構與 zh 示範案完全同構（同 id／同群組／同指派），內容改寫成英語情境。
// 原則（07 對照表第 4 條）：示範案不翻譯、重寫——這份是英語市場的第一印象。
export function sampleProjectEn(): Project {
  return normalizeProject({
    meta: {
      title: "Sample — Brand Film",
      client: "Sample Productions",
      version: 1,
    },
    films: [{ id: "f1", name: "Version A" }],
    contacts: [
      { role: "Producer", name: "Sample Producer", phone: "0900-000-000" },
      { role: "Executive Producer", name: "Sample EP", phone: "0900-000-000" },
      { role: "Director", name: "Armin Kao", phone: "0900-000-000" },
    ],
    cuts: [
      { id: "c1", groupId: "g1", shot: "W", desc: "Sunlight through the leaves", vo: "Water comes from nature.", sup: "Sample super A", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c2", groupId: "g2", shot: "M", desc: "She washes dishes at the sink", vo: "Every time you hear water running", sup: "Sample super B", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c3", groupId: "g3", shot: "M", desc: "She sets the plates down", vo: "you can feel it moving", sup: "Sample super C", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c4", groupId: "g4", shot: "CU", desc: "A drop slides off the plate", vo: "carrying nutrients in, and grime away", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c5", groupId: "g5", shot: "M", desc: "The fruit she just rinsed", vo: "And we know that every wash", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c6", groupId: "g5", shot: "CU", desc: "Slow push-in on the fruit in her hands", vo: "is water finding its way back to nature", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c7", groupId: "g6", shot: "W", desc: "Wind over sky and grassland", vo: "When clean is no longer a burden", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c8", groupId: "g7", shot: "W", desc: "A dragonfly over the lake", vo: "life can breathe easy", sup: "", imageRef: null, prompt: "", props: "", note: "" },
    ],
    days: [
      {
        id: "d1",
        date: "2026-07-19",
        callTime: "07:30",
        callGroups: [
          { label: "Production", time: "07:00", loc: "Meeting point A (sample)" },
          { label: "Hair & Makeup", time: "07:00", loc: "Meeting point A (sample)" },
          { label: "Director's team", time: "07:30", loc: "Meeting point A (sample)" },
          { label: "Camera · Lighting · Sound", time: "07:30", loc: "Meeting point A (sample)" },
          { label: "Talent", time: "08:30", loc: "Straight to Location A (sample)" },
        ],
        rundown: [
          { id: "b1", durMin: 30, type: "call", title: "Crew call · load gear", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
          { id: "b2", durMin: 30, type: "move", title: "Travel to Location A", loc: "Location A (sample address)", mapUrl: "#", park: "Street parking (sample)", props: "", cutIds: [], note: "" },
          { id: "b3", durMin: 90, type: "shoot", title: "Location A: exterior day", loc: "Location A (sample address)", mapUrl: "#", park: "Street parking (sample)", props: "None", cutIds: ["c1", "c7", "c8"], note: "Sample note" },
          { id: "b4", durMin: 60, type: "move", title: "Move + setup | Location B", loc: "Location B (sample address)", mapUrl: "#", park: "Nearby lot (sample)", props: "", cutIds: [], note: "" },
          { id: "b5", durMin: 60, type: "meal", title: "Crew lunch", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
          { id: "b6", durMin: 90, type: "shoot", title: "Location B: interiors", loc: "Location B (sample address)", mapUrl: "", park: "", props: "Sample props ×6, set dressing", cutIds: ["c2", "c3", "c4"], note: "" },
          { id: "b7", durMin: 60, type: "shoot", title: "Location B: pickups & close-ups", loc: "Location B (sample address)", mapUrl: "", park: "", props: "Sample props (small)", cutIds: ["c5", "c6"], note: "" },
          { id: "b8", durMin: 30, type: "other", title: "Wrap · gear check", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
        ],
      },
    ],
    milestones: [
      { id: "m1", label: "Shoot", start: "2026-07-19", end: "2026-07-19" },
      { id: "m2", label: "A copy", start: "2026-07-22", end: "2026-07-24" },
      { id: "m3", label: "Client feedback", start: "2026-07-25", end: "2026-07-27" },
      { id: "m4", label: "B copy", start: "2026-07-28", end: "2026-07-31" },
      { id: "m5", label: "Client feedback", start: "2026-08-01", end: "2026-08-03" },
      { id: "m6", label: "Final", start: "2026-08-06", end: "2026-08-07" },
    ],
    refPages: {
      tone: [
        { id: "t1", imageRef: null, title: "Look ref A (sample)", note: "Natural light first; lived-in feel." },
        { id: "t2", imageRef: null, title: "Look ref B (sample)", note: "Clean, bright palette; translucent textures." },
        { id: "t3", imageRef: null, title: "Look ref C (sample)", note: "Natural greens" },
        { id: "t4", imageRef: null, title: "Look ref D (sample)", note: "High-contrast sunset light indoors" },
      ],
      rhythm: [
        { id: "rh1", imageRef: null, title: "Rhythm ref (sample)", note: "VO leads the film; soft melody over natural ambience" },
      ],
      references: [
        { id: "rf1", imageRef: null, title: "Action ref (sample)", note: "Pace and direction of hand movement; camera close but never in the way.", cutRefs: ["c3", "c4"] },
      ],
      actor: [
        { id: "a1", imageRef: null, title: "Talent ref (sample)", note: "Clean, natural presence; age range and styling direction." },
      ],
      wardrobe: [
        { id: "w1", imageRef: null, title: "White house dress", note: "One-piece" },
      ],
      setting: [
        { id: "s1", imageRef: null, title: "Dish rack and white plates", note: "" },
      ],
      location: [
        { id: "l1", imageRef: null, title: "Location ref (sample)", note: "Good daylight, warm materials; sense of space and set direction." },
      ],
    },
  });
}
