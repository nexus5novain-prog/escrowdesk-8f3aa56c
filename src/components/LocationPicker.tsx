import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRegions, listCountries } from "@/lib/escrow-portal.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";

export type LocationValue = {
  region_code?: string;
  country?: string;
  state?: string;
  city?: string;
};

type Props = {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
};

export function LocationPicker({ value, onChange }: Props) {
  const fetchRegions = useServerFn(listRegions);
  const fetchCountries = useServerFn(listCountries);

  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: () => fetchRegions(),
    staleTime: 60 * 60_000,
  });

  const { data: countries = [] } = useQuery({
    queryKey: ["countries", value.region_code ?? "all"],
    queryFn: () => fetchCountries({ data: { region_code: value.region_code } }),
    staleTime: 60 * 60_000,
  });

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Location
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Region</Label>
          <Select
            value={value.region_code ?? ""}
            onValueChange={(v) =>
              onChange({ region_code: v || undefined, country: undefined, state: undefined, city: undefined })
            }
          >
            <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Country</Label>
          <Select
            value={value.country ?? ""}
            onValueChange={(v) => onChange({ ...value, country: v || undefined, state: undefined, city: undefined })}
            disabled={countries.length === 0}
          >
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">State / Province</Label>
          <Input
            value={value.state ?? ""}
            onChange={(e) => onChange({ ...value, state: e.target.value || undefined })}
            placeholder="e.g. Lagos"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City</Label>
          <Input
            value={value.city ?? ""}
            onChange={(e) => onChange({ ...value, city: e.target.value || undefined })}
            placeholder="e.g. Lekki"
          />
        </div>
      </div>
    </div>
  );
}
