"use client";

import { useState } from "react";

export function ProductImageGallery({ images, name, color }: { images: string[]; name: string; color: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (images.length === 0) return null;
  const selectedIndex = Math.min(activeIndex, images.length - 1);

  return <div className="product-detail-image-gallery">
    <div className={`product-detail-art art-${color}`}>
      <img src={images[selectedIndex]} alt={`${name} · imagem ${selectedIndex + 1}`} width="960" height="760" />
    </div>
    {images.length > 1 && <div className="product-detail-image-thumbnails" role="group" aria-label={`Imagens de ${name}`}>
      {images.map((image, index) => <button
        className="product-detail-image-thumb"
        type="button"
        key={`${image}-${index}`}
        aria-label={`Exibir imagem ${index + 1} de ${images.length}`}
        aria-pressed={selectedIndex === index}
        onClick={() => setActiveIndex(index)}
      ><img src={image} alt="" width="64" height="64" loading="lazy" /></button>)}
    </div>}
  </div>;
}
