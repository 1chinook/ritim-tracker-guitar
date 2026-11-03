import { validateNotes } from "./tab-model.js";

// Her düzenleme öncesinin kopyası tutulur; kaydedilen taslakla aynı nesne paylaşılmaz.
export class TabHistory {
  past = [];
  future = [];

  record(previous, next) {
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    this.past.push(validateNotes(previous));
    this.past = this.past.slice(-50);
    this.future = [];
  }

  undo(current) {
    if (!this.past.length) return validateNotes(current);
    this.future.push(validateNotes(current));
    return this.past.pop();
  }

  redo(current) {
    if (!this.future.length) return validateNotes(current);
    this.past.push(validateNotes(current));
    return this.future.pop();
  }
}
