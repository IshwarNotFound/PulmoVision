"use client";

import styles from "./Views.module.css";

interface OriginalViewProps {
  imageSrc: string | null;
  zoom: number;
}

export const OriginalView = ({ imageSrc, zoom }: OriginalViewProps) => (
  <div className={styles.viewRoot}>
    <div className={styles.zoomLayer} style={{ transform: `scale(${zoom / 100})` }}>
      {imageSrc ? (
        <img src={imageSrc} alt="Original chest radiograph" className={styles.image} />
      ) : (
        <div className={styles.missingImageNotice}>No raster preview is available for this DICOM study.</div>
      )}
    </div>
  </div>
);
