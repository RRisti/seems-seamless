export const formatNumber = (value) => +value.toFixed(2);
export const closestStepIncrement = (value, step) => Math.floor(value / step + 1) * step;
export const closestStepDecrement = (value, step) => Math.ceil(value / step - 1) * step;
