// React DOM interaction tests use act to flush committed effects and state.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
