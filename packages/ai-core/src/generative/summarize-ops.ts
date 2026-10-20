import type { EditOperation } from "@hybridator/core-model";

/** Libellé court d'une EditOperation pour preview UI (jamais d'apply ici). */
export function summarizeEditOperation(op: EditOperation): string {
  switch (op.type) {
    case "ADD_ASSET":
      return `Chutier ← ${op.asset.name} (${op.asset.kind})`;
    case "ADD_CLIP":
      return `Timeline ← « ${op.clip.label ?? op.clip.id} » @ ${op.clip.start.toFixed(1)}s`;
    case "ADD_EFFECT":
      return `Effet « ${op.effect.type} » sur ${op.clipId}`;
    case "REMOVE_EFFECT":
      return `Retirer effet ${op.effectId} de ${op.clipId}`;
    case "SET_TRANSITION":
      return op.transition
        ? `Transition « ${op.transition.type} » sur ${op.clipId}`
        : `Retirer transition de ${op.clipId}`;
    case "UPDATE_CLIP":
      return `Mettre à jour clip ${op.clipId}`;
    case "CHANGE_SPEED":
      return `Vitesse ×${op.speed} sur ${op.clipId}`;
    case "SWITCH_CAMERA_ANGLE":
      return `Angle ${op.angleId} @ ${op.time.toFixed(1)}s`;
    case "SPLIT_CLIP":
      return `Couper ${op.clipId} @ ${op.position.toFixed(1)}s`;
    case "DELETE_CLIP":
      return `Supprimer clip ${op.clipId}${op.ripple ? " (ripple)" : ""}`;
    case "MOVE_CLIP":
      return `Déplacer ${op.clipId} → ${op.start.toFixed(1)}s`;
    case "REMOVE_RANGE":
      return `Retirer plage ${op.start.toFixed(1)}–${op.end.toFixed(1)}s (${op.reason})`;
    case "ADD_TRACK":
      return `Ajouter piste ${op.track.name ?? op.track.id}`;
    case "SET_TRACK":
      return `Piste ${op.trackId} mise à jour`;
    case "REMOVE_ASSET":
      return `Retirer asset ${op.assetId}`;
    case "RESIZE_CLIP":
      return `Redimensionner ${op.clipId}`;
    case "UNLINK_AUDIO":
      return `Extraire audio de ${op.clipId}`;
    case "LINK_CLIPS":
      return `Lier ${op.clipIds.length} clips`;
    default: {
      const _exhaustive: never = op;
      return String((_exhaustive as EditOperation).type);
    }
  }
}

export function summarizeEditOperations(ops: EditOperation[], limit = 12): string[] {
  const lines = ops.map(summarizeEditOperation);
  if (lines.length <= limit) return lines;
  return [...lines.slice(0, limit), `… +${lines.length - limit} autre(s)`];
}
