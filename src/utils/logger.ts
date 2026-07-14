export interface Logger {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export const consoleLogger: Logger = {
  info: (message) => console.log(message),
  warning: (message) => console.warn(message),
  error: (message) => console.error(message),
};
