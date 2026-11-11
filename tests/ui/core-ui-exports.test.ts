import { describe, expect, test } from "bun:test";

import React from "react";
import { renderToString } from "react-dom/server";

import * as AlertModule from "@/components/ui/alert";
import * as BadgeModule from "@/components/ui/badge";
import * as ButtonModule from "@/components/ui/button";
import * as CardModule from "@/components/ui/card";
import * as CheckboxModule from "@/components/ui/checkbox";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Badge,
  badgeVariants,
  Button,
  buttonVariants,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  CoreThemeStyle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
  Label,
  ScrollArea,
  ScrollBar,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Spinner,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  tabsListVariants,
  TabsTrigger,
  Textarea,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  toggleVariants,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/core";
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

describe("UI Core Re-export Parity", () => {
  test("re-exports all Alert symbols with referential equality", () => {
    expect(AlertModule.Alert).toBe(Alert);
    expect(AlertModule.AlertAction).toBe(AlertAction);
    expect(AlertModule.AlertDescription).toBe(AlertDescription);
    expect(AlertModule.AlertTitle).toBe(AlertTitle);
  });

  test("re-exports all Badge symbols with referential equality", () => {
    expect(BadgeModule.Badge).toBe(Badge);
    expect(BadgeModule.badgeVariants).toBe(badgeVariants);
  });

  test("re-exports all Button symbols with referential equality", () => {
    expect(ButtonModule.Button).toBe(Button);
    expect(ButtonModule.buttonVariants).toBe(buttonVariants);
  });

  test("re-exports all Card symbols with referential equality", () => {
    expect(CardModule.Card).toBe(Card);
    expect(CardModule.CardAction).toBe(CardAction);
    expect(CardModule.CardContent).toBe(CardContent);
    expect(CardModule.CardDescription).toBe(CardDescription);
    expect(CardModule.CardFooter).toBe(CardFooter);
    expect(CardModule.CardHeader).toBe(CardHeader);
    expect(CardModule.CardTitle).toBe(CardTitle);
  });

  test("re-exports all Checkbox symbols with referential equality", () => {
    expect(CheckboxModule.Checkbox).toBe(Checkbox);
  });

  test("re-exports all Dialog symbols with referential equality", () => {
    expect(DialogModule.Dialog).toBe(Dialog);
    expect(DialogModule.DialogClose).toBe(DialogClose);
    expect(DialogModule.DialogContent).toBe(DialogContent);
    expect(DialogModule.DialogDescription).toBe(DialogDescription);
    expect(DialogModule.DialogFooter).toBe(DialogFooter);
    expect(DialogModule.DialogHeader).toBe(DialogHeader);
    expect(DialogModule.DialogOverlay).toBe(DialogOverlay);
    expect(DialogModule.DialogPortal).toBe(DialogPortal);
    expect(DialogModule.DialogTitle).toBe(DialogTitle);
    expect(DialogModule.DialogTrigger).toBe(DialogTrigger);
  });

  test("re-exports all Empty symbols with referential equality", () => {
    expect(EmptyModule.Empty).toBe(Empty);
    expect(EmptyModule.EmptyContent).toBe(EmptyContent);
    expect(EmptyModule.EmptyDescription).toBe(EmptyDescription);
    expect(EmptyModule.EmptyHeader).toBe(EmptyHeader);
    expect(EmptyModule.EmptyMedia).toBe(EmptyMedia);
    expect(EmptyModule.EmptyTitle).toBe(EmptyTitle);
  });

  test("re-exports all Field symbols with referential equality", () => {
    expect(FieldModule.Field).toBe(Field);
    expect(FieldModule.FieldContent).toBe(FieldContent);
    expect(FieldModule.FieldDescription).toBe(FieldDescription);
    expect(FieldModule.FieldError).toBe(FieldError);
    expect(FieldModule.FieldGroup).toBe(FieldGroup);
    expect(FieldModule.FieldLabel).toBe(FieldLabel);
    expect(FieldModule.FieldLegend).toBe(FieldLegend);
    expect(FieldModule.FieldSeparator).toBe(FieldSeparator);
    expect(FieldModule.FieldSet).toBe(FieldSet);
    expect(FieldModule.FieldTitle).toBe(FieldTitle);
  });

  test("re-exports all InputGroup symbols with referential equality", () => {
    expect(InputGroupModule.InputGroup).toBe(InputGroup);
    expect(InputGroupModule.InputGroupAddon).toBe(InputGroupAddon);
    expect(InputGroupModule.InputGroupButton).toBe(InputGroupButton);
    expect(InputGroupModule.InputGroupInput).toBe(InputGroupInput);
    expect(InputGroupModule.InputGroupText).toBe(InputGroupText);
    expect(InputGroupModule.InputGroupTextarea).toBe(InputGroupTextarea);
  });

  test("re-exports all Input symbols with referential equality", () => {
    expect(InputModule.Input).toBe(Input);
  });

  test("re-exports all Label symbols with referential equality", () => {
    expect(LabelModule.Label).toBe(Label);
  });

  test("re-exports all ScrollArea symbols with referential equality", () => {
    expect(ScrollAreaModule.ScrollArea).toBe(ScrollArea);
    expect(ScrollAreaModule.ScrollBar).toBe(ScrollBar);
  });

  test("re-exports all Select symbols with referential equality", () => {
    expect(SelectModule.Select).toBe(Select);
    expect(SelectModule.SelectContent).toBe(SelectContent);
    expect(SelectModule.SelectGroup).toBe(SelectGroup);
    expect(SelectModule.SelectItem).toBe(SelectItem);
    expect(SelectModule.SelectLabel).toBe(SelectLabel);
    expect(SelectModule.SelectScrollDownButton).toBe(SelectScrollDownButton);
    expect(SelectModule.SelectScrollUpButton).toBe(SelectScrollUpButton);
    expect(SelectModule.SelectSeparator).toBe(SelectSeparator);
    expect(SelectModule.SelectTrigger).toBe(SelectTrigger);
    expect(SelectModule.SelectValue).toBe(SelectValue);
  });

  test("re-exports all Separator symbols with referential equality", () => {
    expect(SeparatorModule.Separator).toBe(Separator);
  });

  test("re-exports all Slider symbols with referential equality", () => {
    expect(SliderModule.Slider).toBe(Slider);
  });

  test("re-exports all Spinner symbols with referential equality", () => {
    expect(SpinnerModule.Spinner).toBe(Spinner);
  });

  test("re-exports all Table symbols with referential equality", () => {
    expect(TableModule.Table).toBe(Table);
    expect(TableModule.TableBody).toBe(TableBody);
    expect(TableModule.TableCaption).toBe(TableCaption);
    expect(TableModule.TableCell).toBe(TableCell);
    expect(TableModule.TableFooter).toBe(TableFooter);
    expect(TableModule.TableHead).toBe(TableHead);
    expect(TableModule.TableHeader).toBe(TableHeader);
    expect(TableModule.TableRow).toBe(TableRow);
  });

  test("re-exports all Tabs symbols with referential equality", () => {
    expect(TabsModule.Tabs).toBe(Tabs);
    expect(TabsModule.TabsContent).toBe(TabsContent);
    expect(TabsModule.TabsList).toBe(TabsList);
    expect(TabsModule.TabsTrigger).toBe(TabsTrigger);
    expect(TabsModule.tabsListVariants).toBe(tabsListVariants);
  });

  test("re-exports all Textarea symbols with referential equality", () => {
    expect(TextareaModule.Textarea).toBe(Textarea);
  });

  test("re-exports all ToggleGroup symbols with referential equality", () => {
    expect(ToggleGroupModule.ToggleGroup).toBe(ToggleGroup);
    expect(ToggleGroupModule.ToggleGroupItem).toBe(ToggleGroupItem);
  });

  test("re-exports all Toggle symbols with referential equality", () => {
    expect(ToggleModule.Toggle).toBe(Toggle);
    expect(ToggleModule.toggleVariants).toBe(toggleVariants);
  });

  test("re-exports all Tooltip symbols with referential equality", () => {
    expect(TooltipModule.Tooltip).toBe(Tooltip);
    expect(TooltipModule.TooltipContent).toBe(TooltipContent);
    expect(TooltipModule.TooltipProvider).toBe(TooltipProvider);
    expect(TooltipModule.TooltipTrigger).toBe(TooltipTrigger);
  });
});

describe("CoreThemeStyle SSR Rendering", () => {
  test("renders valid theme CSS style tag with expected CSS custom properties", () => {
    const html = renderToString(React.createElement(CoreThemeStyle));
    expect(html).toContain('<style id="core-theme"');
    expect(html).toContain(":root");
    expect(html).toContain("--primary:#06b6d4");
    expect(html).toContain("--radius:0.625rem");
    expect(html).toContain("--card:#0f1416");
    expect(html).toContain("--background:#0a0a0a");
  });
});
