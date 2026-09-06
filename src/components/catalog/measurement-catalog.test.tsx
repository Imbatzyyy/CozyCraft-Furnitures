import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import catalog from "@/lib/catalog/measurement-catalog.fixture.json";
import { parseDimensionSpecs } from "@/lib/catalog/product-specs";
import { sketchKind } from "@/lib/catalog/measurement-sketch";
import { ProductMeasurements } from "./ProductMeasurements";

it.each(catalog)("renders a recognized furniture sketch for $name ($subcategory)", product => {
  const specs = parseDimensionSpecs(product.dimensions);
  expect(sketchKind(product.subcategory,specs)).not.toBe("unknown");
  const html=renderToStaticMarkup(<ProductMeasurements name={product.name} type={product.subcategory} specs={specs}/>);
  expect(html).toContain('<svg');
  expect(html).not.toContain('NaN');
  expect(html).not.toContain('<img');
});
