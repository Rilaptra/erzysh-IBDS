import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToString } from "react-dom/server";

// Re-export modules
import * as AlertModule from "@/components/ui/alert";
import * as BadgeModule from "@/components/ui/badge";
import * as ButtonModule from "@/components/ui/button";
import * as CardModule from "@/components/ui/card";
import * as CheckboxModule from "@/components/ui/checkbox";
import * as CoreModule from "@/components/ui/core";
import * as DialogModule from "@/components/ui/dialog";
import * as EmptyModule from "@/components/ui/empty";
import * as FieldModule from "@/components/ui/field";
import * as InputModule from "@/components/ui/input";
import * as InputGroupModule from "@/components/ui/input-group";
import * as LabelModule from "@/components/ui/label";
import * as ScrollAreaModule from "@/components/ui/scroll-area";
import * as SelectModule from "@/components/ui/select";
import * as SeparatorModule from "@/components/ui/separator";
import * as SliderModule from "@/components/ui/slider";
import * as SpinnerModule from "@/components/ui/spinner";
import * as TableModule from "@/components/ui/table";
import * as TabsModule from "@/components/ui/tabs";
import * as TextareaModule from "@/components/ui/textarea";
import * as ToggleModule from "@/components/ui/toggle";
import * as ToggleGroupModule from "@/components/ui/toggle-group";
import * as TooltipModule from "@/components/ui/tooltip";

describe("Challenger Empirical Suite: UI Re-export Parity & Exhaustiveness", () => {
  const moduleChecks: Array<{
    name: string;
    mod: Record<string, unknown>;
    expectedKeys: string[];
  }> = [
    {
      name: "alert",
      mod: AlertModule,
      expectedKeys: ["Alert", "AlertAction", "AlertDescription", "AlertTitle"],
    },
    {
      name: "badge",
      mod: BadgeModule,
      expectedKeys: ["Badge", "badgeVariants"],
    },
    {
      name: "button",
      mod: ButtonModule,
      expectedKeys: ["Button", "buttonVariants"],
    },
    {
      name: "card",
      mod: CardModule,
      expectedKeys: [
        "Card",
        "CardAction",
        "CardContent",
        "CardDescription",
        "CardFooter",
        "CardHeader",
        "CardTitle",
      ],
    },
    {
      name: "checkbox",
      mod: CheckboxModule,
      expectedKeys: ["Checkbox"],
    },
    {
      name: "dialog",
      mod: DialogModule,
      expectedKeys: [
        "Dialog",
        "DialogClose",
        "DialogContent",
        "DialogDescription",
        "DialogFooter",
        "DialogHeader",
        "DialogOverlay",
        "DialogPortal",
        "DialogTitle",
        "DialogTrigger",
      ],
    },
    {
      name: "empty",
      mod: EmptyModule,
      expectedKeys: [
        "Empty",
        "EmptyContent",
        "EmptyDescription",
        "EmptyHeader",
        "EmptyMedia",
        "EmptyTitle",
      ],
    },
    {
      name: "field",
      mod: FieldModule,
      expectedKeys: [
        "Field",
        "FieldContent",
        "FieldDescription",
        "FieldError",
        "FieldGroup",
        "FieldLabel",
        "FieldLegend",
        "FieldSeparator",
        "FieldSet",
        "FieldTitle",
      ],
    },
    {
      name: "input-group",
      mod: InputGroupModule,
      expectedKeys: [
        "InputGroup",
        "InputGroupAddon",
        "InputGroupButton",
        "InputGroupInput",
        "InputGroupText",
        "InputGroupTextarea",
      ],
    },
    {
      name: "input",
      mod: InputModule,
      expectedKeys: ["Input"],
    },
    {
      name: "label",
      mod: LabelModule,
      expectedKeys: ["Label"],
    },
    {
      name: "scroll-area",
      mod: ScrollAreaModule,
      expectedKeys: ["ScrollArea", "ScrollBar"],
    },
    {
      name: "select",
      mod: SelectModule,
      expectedKeys: [
        "Select",
        "SelectContent",
        "SelectGroup",
        "SelectItem",
        "SelectLabel",
        "SelectScrollDownButton",
        "SelectScrollUpButton",
        "SelectSeparator",
        "SelectTrigger",
        "SelectValue",
      ],
    },
    {
      name: "separator",
      mod: SeparatorModule,
      expectedKeys: ["Separator"],
    },
    {
      name: "slider",
      mod: SliderModule,
      expectedKeys: ["Slider"],
    },
    {
      name: "spinner",
      mod: SpinnerModule,
      expectedKeys: ["Spinner"],
    },
    {
      name: "table",
      mod: TableModule,
      expectedKeys: [
        "Table",
        "TableBody",
        "TableCaption",
        "TableCell",
        "TableFooter",
        "TableHead",
        "TableHeader",
        "TableRow",
      ],
    },
    {
      name: "tabs",
      mod: TabsModule,
      expectedKeys: ["Tabs", "TabsContent", "TabsList", "TabsTrigger", "tabsListVariants"],
    },
    {
      name: "textarea",
      mod: TextareaModule,
      expectedKeys: ["Textarea"],
    },
    {
      name: "toggle-group",
      mod: ToggleGroupModule,
      expectedKeys: ["ToggleGroup", "ToggleGroupItem"],
    },
    {
      name: "toggle",
      mod: ToggleModule,
      expectedKeys: ["Toggle", "toggleVariants"],
    },
    {
      name: "tooltip",
      mod: TooltipModule,
      expectedKeys: ["Tooltip", "TooltipContent", "TooltipProvider", "TooltipTrigger"],
    },
  ];

  for (const check of moduleChecks) {
    test(`module ${check.name} re-exports exact expected symbols with referential identity`, () => {
      const keys = Object.keys(check.mod).sort();
      expect(keys).toEqual(check.expectedKeys.sort());

      for (const key of check.expectedKeys) {
        const reExported = (check.mod as Record<string, unknown>)[key];
        const coreExported = (CoreModule as Record<string, unknown>)[key];
        expect(reExported).toBeDefined();
        expect(reExported).toBe(coreExported);
      }
    });
  }
});

describe("Challenger Empirical Suite: <CoreThemeStyle /> CSS and Palette Integrity", () => {
  const renderedHtml = renderToString(React.createElement(CoreModule.CoreThemeStyle));

  test("renders valid style tag with id=core-theme", () => {
    expect(renderedHtml.startsWith('<style id="core-theme">')).toBe(true);
    expect(renderedHtml.endsWith("</style>")).toBe(true);
  });

  test("contains well-formed CSS with balanced braces and valid selector", () => {
    const cssMatch = renderedHtml.match(/<style id="core-theme">(.*)<\/style>/);
    expect(cssMatch).not.toBeNull();
    const css = cssMatch?.[1] ?? "";

    expect(css.startsWith(":root,.dark{")).toBe(true);
    expect(css.endsWith("}")).toBe(true);

    const openBraces = (css.match(/{/g) || []).length;
    const closeBraces = (css.match(/}/g) || []).length;
    expect(openBraces).toBe(1);
    expect(closeBraces).toBe(1);
  });

  test("contains every single palette color entry verbatim", () => {
    const cssMatch = renderedHtml.match(/<style id="core-theme">(.*)<\/style>/);
    const css = cssMatch?.[1] ?? "";

    const entries = Object.entries(CoreModule.palette.colors);
    expect(entries.length).toBe(36);

    for (const [key, value] of entries) {
      const expectedDeclaration = `--${key}:${value};`;
      expect(css).toContain(expectedDeclaration);
    }
  });

  test("contains colorScheme and all standard radius tokens", () => {
    const cssMatch = renderedHtml.match(/<style id="core-theme">(.*)<\/style>/);
    const css = cssMatch?.[1] ?? "";

    expect(css).toContain(`color-scheme:${CoreModule.palette.colorScheme};`);
    expect(css).toContain(`--radius:${CoreModule.palette.radius};`);
    expect(css).toContain("--radius-sm:calc(var(--radius) - 4px);");
    expect(css).toContain("--radius-md:calc(var(--radius) - 2px);");
    expect(css).toContain("--radius-lg:var(--radius);");
    expect(css).toContain("--radius-xl:calc(var(--radius) + 4px);");
  });
});

describe("Challenger Empirical Suite: Complex Compositions & Variant Stress-Testing", () => {
  test("renders Button across all variants and sizes with HTML parity", () => {
    const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
    const sizes = ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const;

    for (const variant of variants) {
      for (const size of sizes) {
        const reExportHtml = renderToString(
          React.createElement(
            ButtonModule.Button,
            { variant, size, className: "custom-btn" },
            `Click ${variant} ${size}`,
          ),
        );
        const coreHtml = renderToString(
          React.createElement(
            CoreModule.Button,
            { variant, size, className: "custom-btn" },
            `Click ${variant} ${size}`,
          ),
        );

        expect(reExportHtml).toBe(coreHtml);
        expect(reExportHtml).toContain('data-slot="button"');
      }
    }

    // asChild test
    const asChildHtml = renderToString(
      React.createElement(
        ButtonModule.Button,
        { asChild: true, variant: "outline" },
        React.createElement("a", { href: "https://example.com" }, "Link Button"),
      ),
    );
    expect(asChildHtml).toContain("<a");
    expect(asChildHtml).toContain('href="https://example.com"');
    expect(asChildHtml).toContain('data-slot="button"');
  });

  test("renders Badge across all variants with HTML parity", () => {
    const variants = ["default", "secondary", "destructive", "outline", "ghost", "link"] as const;

    for (const variant of variants) {
      const reExportHtml = renderToString(
        React.createElement(
          BadgeModule.Badge,
          { variant, className: "badge-custom" },
          `Badge ${variant}`,
        ),
      );
      const coreHtml = renderToString(
        React.createElement(
          CoreModule.Badge,
          { variant, className: "badge-custom" },
          `Badge ${variant}`,
        ),
      );

      expect(reExportHtml).toBe(coreHtml);
      expect(reExportHtml).toContain('data-slot="badge"');
    }
  });

  test("renders complex nested Card composition with action, header, content, footer", () => {
    const reExportTree = React.createElement(
      CardModule.Card,
      { size: "sm", className: "test-card" },
      React.createElement(
        CardModule.CardHeader,
        null,
        React.createElement(CardModule.CardTitle, null, "Beam Simulation Analysis"),
        React.createElement(CardModule.CardDescription, null, "SNI 2847:2019 Verification"),
        React.createElement(
          CardModule.CardAction,
          null,
          React.createElement(ButtonModule.Button, { size: "xs", variant: "outline" }, "Action"),
        ),
      ),
      React.createElement(
        CardModule.CardContent,
        null,
        React.createElement("p", null, "Maximum moment: 125.4 kNm"),
        React.createElement(BadgeModule.Badge, { variant: "secondary" }, "Verified"),
      ),
      React.createElement(
        CardModule.CardFooter,
        null,
        React.createElement(ButtonModule.Button, { size: "sm" }, "Download Report"),
      ),
    );

    const coreTree = React.createElement(
      CoreModule.Card,
      { size: "sm", className: "test-card" },
      React.createElement(
        CoreModule.CardHeader,
        null,
        React.createElement(CoreModule.CardTitle, null, "Beam Simulation Analysis"),
        React.createElement(CoreModule.CardDescription, null, "SNI 2847:2019 Verification"),
        React.createElement(
          CoreModule.CardAction,
          null,
          React.createElement(CoreModule.Button, { size: "xs", variant: "outline" }, "Action"),
        ),
      ),
      React.createElement(
        CoreModule.CardContent,
        null,
        React.createElement("p", null, "Maximum moment: 125.4 kNm"),
        React.createElement(CoreModule.Badge, { variant: "secondary" }, "Verified"),
      ),
      React.createElement(
        CoreModule.CardFooter,
        null,
        React.createElement(CoreModule.Button, { size: "sm" }, "Download Report"),
      ),
    );

    const reExportHtml = renderToString(reExportTree);
    const coreHtml = renderToString(coreTree);

    expect(reExportHtml).toBe(coreHtml);
    expect(reExportHtml).toContain('data-slot="card"');
    expect(reExportHtml).toContain('data-slot="card-header"');
    expect(reExportHtml).toContain('data-slot="card-title"');
    expect(reExportHtml).toContain('data-slot="card-description"');
    expect(reExportHtml).toContain('data-slot="card-action"');
    expect(reExportHtml).toContain('data-slot="card-content"');
    expect(reExportHtml).toContain('data-slot="card-footer"');
  });

  test("renders complex Alert composition with title, description, and action", () => {
    const reExportTree = React.createElement(
      AlertModule.Alert,
      { variant: "destructive", className: "alert-custom" },
      React.createElement(AlertModule.AlertTitle, null, "Deflection Limit Exceeded"),
      React.createElement(
        AlertModule.AlertDescription,
        null,
        "Calculated deflection of L/210 exceeds serviceability threshold of L/240.",
      ),
      React.createElement(
        AlertModule.AlertAction,
        null,
        React.createElement(
          ButtonModule.Button,
          { size: "xs", variant: "destructive" },
          "Recompute",
        ),
      ),
    );

    const coreTree = React.createElement(
      CoreModule.Alert,
      { variant: "destructive", className: "alert-custom" },
      React.createElement(CoreModule.AlertTitle, null, "Deflection Limit Exceeded"),
      React.createElement(
        CoreModule.AlertDescription,
        null,
        "Calculated deflection of L/210 exceeds serviceability threshold of L/240.",
      ),
      React.createElement(
        CoreModule.AlertAction,
        null,
        React.createElement(CoreModule.Button, { size: "xs", variant: "destructive" }, "Recompute"),
      ),
    );

    const reExportHtml = renderToString(reExportTree);
    const coreHtml = renderToString(coreTree);

    expect(reExportHtml).toBe(coreHtml);
    expect(reExportHtml).toContain('role="alert"');
    expect(reExportHtml).toContain('data-slot="alert-title"');
    expect(reExportHtml).toContain('data-slot="alert-description"');
    expect(reExportHtml).toContain('data-slot="alert-action"');
  });

  test("renders Field, InputGroup, and Select compositions seamlessly", () => {
    const fieldTree = React.createElement(
      FieldModule.FieldSet,
      null,
      React.createElement(FieldModule.FieldLegend, null, "Section Properties"),
      React.createElement(
        FieldModule.FieldGroup,
        null,
        React.createElement(
          FieldModule.Field,
          { orientation: "horizontal" },
          React.createElement(FieldModule.FieldLabel, null, "Beam Depth (d)"),
          React.createElement(
            FieldModule.FieldContent,
            null,
            React.createElement(
              InputGroupModule.InputGroup,
              null,
              React.createElement(InputGroupModule.InputGroupInput, { placeholder: "400" }),
              React.createElement(InputGroupModule.InputGroupAddon, null, "mm"),
            ),
          ),
          React.createElement(FieldModule.FieldDescription, null, "Effective concrete depth"),
          React.createElement(FieldModule.FieldError, {
            errors: [{ message: "Must be >= 200 mm" }],
          }),
        ),
      ),
      React.createElement(FieldModule.FieldSeparator, null),
    );

    const fieldHtml = renderToString(fieldTree);
    expect(fieldHtml).toContain('data-slot="field-set"');
    expect(fieldHtml).toContain('data-slot="field-group"');
    expect(fieldHtml).toContain('data-slot="field-label"');
    expect(fieldHtml).toContain('data-slot="input-group"');
    expect(fieldHtml).toContain('data-slot="field-error"');
    expect(fieldHtml).toContain("Must be &gt;= 200 mm");
  });

  test("renders Table and Tabs compositions seamlessly", () => {
    const tableTree = React.createElement(
      TableModule.Table,
      null,
      React.createElement(TableModule.TableCaption, null, "Design Summary"),
      React.createElement(
        TableModule.TableHeader,
        null,
        React.createElement(
          TableModule.TableRow,
          null,
          React.createElement(TableModule.TableHead, null, "Parameter"),
          React.createElement(TableModule.TableHead, null, "Value"),
        ),
      ),
      React.createElement(
        TableModule.TableBody,
        null,
        React.createElement(
          TableModule.TableRow,
          null,
          React.createElement(TableModule.TableCell, null, "Mu"),
          React.createElement(TableModule.TableCell, null, "150 kNm"),
        ),
      ),
      React.createElement(
        TableModule.TableFooter,
        null,
        React.createElement(
          TableModule.TableRow,
          null,
          React.createElement(TableModule.TableCell, null, "Status"),
          React.createElement(TableModule.TableCell, null, "OK"),
        ),
      ),
    );

    const tableHtml = renderToString(tableTree);
    expect(tableHtml).toContain("<table");
    expect(tableHtml).toContain("<thead");
    expect(tableHtml).toContain("<tbody");
    expect(tableHtml).toContain("<tfoot");
    expect(tableHtml).toContain("150 kNm");

    const tabsTree = React.createElement(
      TabsModule.Tabs,
      { defaultValue: "geometry" },
      React.createElement(
        TabsModule.TabsList,
        { variant: "line" },
        React.createElement(TabsModule.TabsTrigger, { value: "geometry" }, "Geometry"),
        React.createElement(TabsModule.TabsTrigger, { value: "loads" }, "Loads"),
      ),
      React.createElement(TabsModule.TabsContent, { value: "geometry" }, "Geometry Panel"),
    );

    const tabsHtml = renderToString(tabsTree);
    expect(tabsHtml).toContain('data-slot="tabs"');
    expect(tabsHtml).toContain('data-slot="tabs-list"');
    expect(tabsHtml).toContain('data-slot="tabs-trigger"');
    expect(tabsHtml).toContain("Geometry");
  });
});

describe("Challenger Empirical Suite: Single Source of Truth (SST) Dynamic Propagation", () => {
  const coreFilePath = path.resolve(process.cwd(), "src/components/ui/core.tsx");

  test("mutating palette color in core.tsx immediately alters <CoreThemeStyle /> CSS output", () => {
    const originalContent = fs.readFileSync(coreFilePath, "utf8");
    const testColorHex = "#ff1493"; // DeepPink test color

    try {
      expect(originalContent).toContain('primary: "#06b6d4",');

      // Mutate palette.colors.primary in core.tsx
      const modifiedContent = originalContent.replace(
        'primary: "#06b6d4",',
        `primary: "${testColorHex}",`,
      );
      fs.writeFileSync(coreFilePath, modifiedContent, "utf8");

      // Execute subprocess with fresh module evaluation
      const output = execSync(
        "bun -e \"import React from 'react'; import { renderToString } from 'react-dom/server'; import { CoreThemeStyle } from './src/components/ui/core'; console.log(renderToString(React.createElement(CoreThemeStyle)));\"",
        { encoding: "utf8", cwd: process.cwd() },
      );

      expect(output).toContain(`--primary:${testColorHex};`);
      expect(output).not.toContain("--primary:#06b6d4;");
    } finally {
      // Restore core.tsx unconditionally
      fs.writeFileSync(coreFilePath, originalContent, "utf8");
    }

    // Verify restoration
    const restoredOutput = execSync(
      "bun -e \"import React from 'react'; import { renderToString } from 'react-dom/server'; import { CoreThemeStyle } from './src/components/ui/core'; console.log(renderToString(React.createElement(CoreThemeStyle)));\"",
      { encoding: "utf8", cwd: process.cwd() },
    );

    expect(restoredOutput).toContain("--primary:#06b6d4;");
    expect(restoredOutput).not.toContain(testColorHex);
  });
});
