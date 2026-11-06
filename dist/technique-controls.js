export function initializeTechniqueControls({
  find,
  onChange,
  onLink,
  bendAmount,
}) {
  const ring = find("editorLetRing");
  const tapping = find("editorTapping");
  const harmonic = find("editorHarmonic");
  const tremolo = find("editorTremolo");
  const picking = find("editorPickDirection");
  const curve = find("editorBendCurve");
  const shape = find("editorBendShape");
  const graph = find("editorBendGraph");
  const link = find("editorLinkNotes");
  const linkType = find("editorLinkType");
  for (const control of [ring, tapping, harmonic, tremolo, picking, curve])
    control.addEventListener("change", onChange);
  shape.addEventListener("change", () => {
    const amount = bendAmount();
    const shapes = {
      hold: "0:0, 0.7:" + amount + ", 1:" + amount,
      release: "0:0, 0.5:" + amount + ", 1:0",
      preBend: "0:" + amount + ", 0.3:" + amount + ", 1:0",
    };
    curve.value = shapes[shape.value] ?? "";
    onChange();
  });
  link.addEventListener("click", () => onLink(linkType.value || "slide"));
  return {
    read() {
      const effects = [];
      if (ring.checked) effects.push({ type: "letRing" });
      if (tapping.checked) effects.push({ type: "tapping" });
      if (harmonic.value && harmonic.value !== "none")
        effects.push({ type: "harmonic", kind: harmonic.value });
      if (tremolo.value && tremolo.value !== "none")
        effects.push({
          type: "tremoloPicking",
          subdivision: Number(tremolo.value),
        });
      if (picking.value && picking.value !== "none")
        effects.push({ type: "pickDirection", direction: picking.value });
      return effects;
    },
    curve() {
      if (!curve.value.trim()) return undefined;
      return curve.value.split(",").map((pair) => {
        const values = pair.trim().split(":");
        if (values.length !== 2 || values.some((value) => !value.trim()))
          throw new Error("Eğriyi 0:0, 0.5:2, 1:0 biçiminde yaz.");
        return { position: Number(values[0]), semitones: Number(values[1]) };
      });
    },
    sync(note) {
      const effect = (type) =>
        note?.techniques.find((item) => item.type === type);
      ring.checked = Boolean(effect("letRing"));
      tapping.checked = Boolean(effect("tapping"));
      harmonic.value = effect("harmonic")?.kind ?? "none";
      tremolo.value = effect("tremoloPicking")?.subdivision ?? "none";
      picking.value = effect("pickDirection")?.direction ?? "none";
      const points = effect("bend")?.curve ?? [];
      curve.value = points
        .map((point) => point.position + ":" + point.semitones)
        .join(", ");
      shape.value = "";
      graph.setAttribute(
        "points",
        points
          .map(
            (point) => point.position * 100 + "," + (30 - point.semitones * 7),
          )
          .join(" "),
      );
    },
    disable(disabled, isBend, canLink, playing) {
      for (const control of [ring, tapping, harmonic, tremolo, picking])
        control.disabled = disabled;
      curve.disabled = shape.disabled = disabled || !isBend;
      linkType.disabled = playing;
      link.disabled = playing || !canLink;
    },
  };
}
