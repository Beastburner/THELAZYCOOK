declare module "./emojis.json" {
  export interface EmojisData {
    reaction: {
      LAUGHTER: string;
      SKULL: string;
      CRYING: string;
      SPARKLES: string;
      FIRE: string;
      HUNDRED: string;
      CHECK: string;
      EYES: string;
      THINKING: string;
      NAIL_POLISH: string;
    };
    expressive: {
      SWEAT: string;
      PLEADING: string;
      SALUTE: string;
      FOLDED_HANDS: string;
      HANDSHAKE: string;
      MELTING: string;
      HOLDING_TEARS: string;
    };
    conversational: {
      POINT_DOWN: string;
      ARROW_UP: string;
      ARROW_RIGHT: string;
      MICROPHONE: string;
      HOT_BEVERAGE: string;
      SHRUG_WOMAN: string;
      SHRUG_MAN: string;
    };
    professional: {
      SUCCESS: string;
      WARNING: string;
      IMPORTANT: string;
      RESTRICTION: string;
      KEY_POINT: string;
      EXPLANATION: string;
      CONCEPT: string;
      NEXT_STEP: string;
      APPROVAL: string;
    };
    categories: {
      reaction: string[];
      expressive: string[];
      conversational: string[];
      professional: string[];
    };
    mappings: {
      [key: string]: string;
    };
  }
  
  const emojisData: EmojisData;
  export default emojisData;
}

