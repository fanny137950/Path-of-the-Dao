// Provider schemas constrain syntax; world validators remain authoritative.
const string = { type: 'STRING' };
const strings = { type: 'ARRAY', items: string };
export const INTENT_RESPONSE_SCHEMA = {
  type: 'OBJECT', required: ['kind'], properties: {
    kind: { type: 'STRING', enum: ['speak', 'continue', 'thought', 'move', 'train', 'wait', 'consume', 'observe', 'gesture', 'unsupported'] },
    target: string, place: string, minutes: { type: 'NUMBER' }, item: string, code: string, reason: string,
  },
};
export const SCENE_RESPONSE_SCHEMA = {
  type: 'OBJECT', required: ['beats'], properties: {
    beats: { type: 'ARRAY', minItems: 1, maxItems: 8, items: {
      type: 'OBJECT', required: ['speaker', 'text'], properties: {
        speaker: string, text: string, memoryRefs: strings, turnToPlayer: { type: 'BOOLEAN' },
        to: string, expression: { type: 'STRING', enum: ['calm', 'joy', 'displeased', 'worried', 'sad', 'surprised'] },
        delivery: string, historyRefs: strings,
        emotion: { type: 'OBJECT', required: ['feeling', 'reason', 'memoryRefs'], properties: {
          feeling: { type: 'STRING', enum: ['平靜', '喜悅', '擔憂', '悲傷', '驚訝', '不悅', '不安', '關切'] }, reason: string, memoryRefs: strings,
        } },
      },
    } },
    topic: string, openQuestion: { type: 'STRING', nullable: true }, questionSpeaker: { type: 'STRING', nullable: true },
    stopReason: { type: 'STRING', enum: ['natural', 'reply', 'decision'] }, remember: { ...strings, maxItems: 3 },
    personalityObservations: { type: 'ARRAY', maxItems: 3, items: { type: 'OBJECT', required: ['trait', 'context', 'quote'], properties: {
      trait: { type: 'STRING', enum: ['humor', 'curiosity', 'caution', 'directness', 'care', 'independence', 'discipline', 'competitiveness'] },
      context: { type: 'STRING', enum: ['general', 'teachers', 'peers', 'risk', 'training'] }, quote: string,
    } } },
  },
};
