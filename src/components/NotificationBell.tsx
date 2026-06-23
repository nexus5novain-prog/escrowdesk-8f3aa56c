import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => list(),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Realtime: live increment on new notifications
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const items = useMemo(() => data?.notifications ?? [], [data]);
  const unread = data?.unread ?? 0;

  if (!user) return null;

  const onItemClick = async (n: { id: string; link: string | null; read_at: string | null }) => {
    if (!n.read_at) {
      await markOne({ data: { id: n.id } });
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    }
    if (n.link) navigate({ to: n.link as never }).catch(() => {});
  };

  const onMarkAll = async () => {
    await markAll();
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-3.5 w-3.5" /> Notifications
            {unread > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{unread} new</Badge>}
          </div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onMarkAll}>
              <CheckCheck className="mr-1 h-3 w-3" /> Mark all
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">You're all caught up.</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onItemClick(n)}
                    className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-secondary/40 ${!n.read_at ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{n.title}</p>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          {" · "}
                          <span className="font-mono">{n.kind.replace(/_/g, " ")}</span>
                        </p>
                      </div>
                      {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      {n.read_at && <Check className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border/60 px-3 py-2 text-center">
          <Button size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={() => navigate({ to: "/settings" })}>
            Notification settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
